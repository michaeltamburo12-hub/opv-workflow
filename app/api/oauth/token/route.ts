import { NextRequest, NextResponse } from 'next/server'
import {
  ClientPayload, CodePayload, RefreshPayload,
  clientFingerprint, issueTokens, noStore, pkceMatches, verify,
} from '@/lib/mcp/oauth'

// Token endpoint: exchanges an authorization code (with PKCE) or a refresh token for tokens.
export async function POST(req: NextRequest) {
  const p = await params(req)
  const clientId = p.get('client_id') || ''
  const client = verify<ClientPayload>(clientId, 'client')
  if (!client) return err('invalid_client', 'Unknown client', 401)
  const cid = clientFingerprint(clientId)

  const grant = p.get('grant_type')
  if (grant === 'authorization_code') {
    const code = verify<CodePayload>(p.get('code'), 'code')
    if (!code || code.cid !== cid) return err('invalid_grant', 'Invalid or expired code')
    if (p.get('redirect_uri') !== code.r) return err('invalid_grant', 'redirect_uri mismatch')
    if (!pkceMatches(p.get('code_verifier'), code.cc)) return err('invalid_grant', 'PKCE verification failed')
    return NextResponse.json(issueTokens(req, cid, code.sub), { headers: noStore })
  }

  if (grant === 'refresh_token') {
    const rt = verify<RefreshPayload>(p.get('refresh_token'), 'refresh')
    if (!rt || rt.cid !== cid) return err('invalid_grant', 'Invalid or expired refresh token')
    return NextResponse.json(issueTokens(req, cid, rt.sub), { headers: noStore })
  }

  return err('unsupported_grant_type', 'Use authorization_code or refresh_token')
}

async function params(req: NextRequest): Promise<URLSearchParams> {
  const type = req.headers.get('content-type') || ''
  if (type.includes('application/json')) {
    try {
      const j = await req.json()
      return new URLSearchParams(Object.entries(j).map(([k, v]) => [k, String(v)]))
    } catch { return new URLSearchParams() }
  }
  return new URLSearchParams(await req.text())
}

const err = (error: string, error_description: string, status = 400) =>
  NextResponse.json({ error, error_description }, { status, headers: noStore })
