import { createHash, createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

// Minimal OAuth 2.1 authorization server for the Claude connector (MCP authorization spec):
// dynamic client registration, authorization code + PKCE (S256), refresh tokens.
//
// Everything is stateless: client ids, codes and tokens are HMAC-signed payloads, so no
// database tables are needed. The signing key is derived from AUTH_SESSION_TOKEN, so
// rotating that env var signs everyone out of the app AND disconnects every Claude client.

export const ACCESS_TTL = 60 * 60 // 1 hour
export const REFRESH_TTL = 60 * 60 * 24 * 30 // 30 days
export const CODE_TTL = 120 // 2 minutes

type TokenType = 'client' | 'code' | 'access' | 'refresh'

export type ClientPayload = { typ: 'client'; r: string[]; n: string }
export type CodePayload = { typ: 'code'; cid: string; r: string; cc: string; sub: string; exp: number }
export type AccessPayload = { typ: 'access'; cid: string; sub: string; aud: string; exp: number }
export type RefreshPayload = { typ: 'refresh'; cid: string; sub: string; exp: number }

function key(): Buffer {
  const secret = process.env.AUTH_SESSION_TOKEN
  if (!secret) throw new Error('AUTH_SESSION_TOKEN is not set')
  return createHash('sha256').update('opv-mcp-oauth:' + secret).digest()
}

export function sign(payload: { typ: TokenType } & Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', key()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verify<T extends { typ: TokenType }>(token: unknown, typ: T['typ']): T | null {
  if (typeof token !== 'string') return null
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  const expected = createHmac('sha256', key()).update(body).digest()
  const got = Buffer.from(sig, 'base64url')
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null
  let p: Record<string, unknown>
  try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { return null }
  if (p.typ !== typ) return null
  if (typeof p.exp === 'number' && Date.now() / 1000 > p.exp) return null
  return p as T
}

export const now = () => Math.floor(Date.now() / 1000)

// Short, stable fingerprint of a client id, embedded in codes/tokens to bind them to that client.
export const clientFingerprint = (clientId: string) =>
  createHash('sha256').update(clientId).digest('base64url').slice(0, 22)

export function pkceMatches(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128) return false
  const computed = createHash('sha256').update(verifier).digest('base64url')
  return computed.length === challenge.length && timingSafeEqual(Buffer.from(computed), Buffer.from(challenge))
}

// Only Claude (web/desktop/mobile go through claude.ai or claude.com) and local tools
// (Claude Code, MCP Inspector) may register. Blocks look-alike sign-in pages that would send
// codes to someone else's site.
export function allowedRedirectUri(uri: unknown): boolean {
  if (typeof uri !== 'string') return false
  try {
    const u = new URL(uri)
    if (u.hash) return false
    if (u.protocol === 'https:' && ['claude.ai', 'claude.com'].includes(u.hostname)) return true
    if (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return true
    return false
  } catch {
    return false
  }
}

export function origin(req: NextRequest): string {
  return (process.env.PUBLIC_ORIGIN || req.nextUrl.origin).replace(/\/$/, '')
}

export const resourceUrl = (req: NextRequest) => `${origin(req)}/api/mcp`
export const resourceMetadataUrl = (req: NextRequest) => `${origin(req)}/.well-known/oauth-protected-resource/api/mcp`

// Returns the signed-in identity for a valid Bearer access token, else null.
export function authenticate(req: NextRequest): AccessPayload | null {
  const h = req.headers.get('authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const t = verify<AccessPayload>(m[1].trim(), 'access')
  if (!t || t.aud !== resourceUrl(req)) return null
  return t
}

export function issueTokens(req: NextRequest, cid: string, sub: string) {
  const t = now()
  return {
    access_token: sign({ typ: 'access', cid, sub, aud: resourceUrl(req), exp: t + ACCESS_TTL }),
    token_type: 'Bearer',
    expires_in: ACCESS_TTL,
    refresh_token: sign({ typ: 'refresh', cid, sub, exp: t + REFRESH_TTL }),
    scope: 'opv',
  }
}

export const noStore = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
