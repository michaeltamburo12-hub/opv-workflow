import { NextRequest, NextResponse } from 'next/server'
import { checkCredentials } from '@/lib/auth-users'
import { hasSession } from '@/lib/session'
import { ClientPayload, CODE_TTL, clientFingerprint, now, sign, verify } from '@/lib/mcp/oauth'

// Authorization endpoint for the Claude connector. Claude opens this page in a browser window;
// the person signs in with their OPV login (or, if already signed in to the app, just clicks
// Allow), and we send them back to Claude with a short-lived, PKCE-bound code.
//
// When per-person email sign-in replaces the shared login, only this page changes.

type AuthParams = {
  client_id: string
  redirect_uri: string
  state: string
  code_challenge: string
  code_challenge_method: string
  response_type: string
  scope: string
}

const FIELDS: (keyof AuthParams)[] = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'response_type', 'scope']

function read(src: URLSearchParams | FormData): AuthParams {
  const o = {} as AuthParams
  for (const f of FIELDS) {
    const v = src.get(f)
    o[f] = typeof v === 'string' ? v : ''
  }
  return o
}

// Checks the request; returns the registered client, or an error to show on the page
// (never redirect to an unverified redirect_uri).
function check(p: AuthParams): { client: ClientPayload } | { error: string } {
  const client = verify<ClientPayload>(p.client_id, 'client')
  if (!client) return { error: 'This connection request is not recognized. Remove the connector in Claude and add it again.' }
  if (!client.r.includes(p.redirect_uri)) return { error: 'This connection request has an invalid return address.' }
  if (p.response_type !== 'code') return { error: 'Unsupported response type.' }
  if (!p.code_challenge || p.code_challenge_method !== 'S256') return { error: 'This connection request is missing PKCE.' }
  return { client }
}

function back(p: AuthParams, extra: Record<string, string>) {
  const u = new URL(p.redirect_uri)
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v)
  if (p.state) u.searchParams.set('state', p.state)
  return NextResponse.redirect(u.toString(), 303)
}

export async function GET(req: NextRequest) {
  const p = read(req.nextUrl.searchParams)
  const c = check(p)
  if ('error' in c) return page({ error: c.error })
  return page({ p, clientName: c.client.n, signedIn: hasSession(req) })
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const p = read(form)
  const c = check(p)
  if ('error' in c) return page({ error: c.error })

  if (form.get('action') === 'deny') return back(p, { error: 'access_denied' })

  // Already signed in to the app in this browser (cookie is SameSite=Lax, so a cross-site
  // form post can't ride on it), or signing in now with the OPV login.
  let sub: string | null = null
  if (form.get('action') === 'allow_session' && hasSession(req)) sub = 'app-session'
  else sub = checkCredentials(form.get('username'), form.get('password'))

  if (!sub) return page({ p, clientName: c.client.n, signedIn: false, error: 'Invalid username or password' }, 401)

  const code = sign({
    typ: 'code',
    cid: clientFingerprint(p.client_id),
    r: p.redirect_uri,
    cc: p.code_challenge,
    sub,
    exp: now() + CODE_TTL,
  })
  return back(p, { code })
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function page(
  o: { p?: AuthParams; clientName?: string; signedIn?: boolean; error?: string },
  status = o.p ? 200 : 400,
) {
  const hidden = o.p
    ? FIELDS.map(f => `<input type="hidden" name="${f}" value="${esc(o.p![f])}">`).join('')
    : ''
  const client = esc(o.clientName || 'Claude')

  const body = !o.p
    ? `<h1>Can't connect</h1><p class="err">${esc(o.error || 'Invalid request')}</p>`
    : `<h1>Connect ${client} to OPV</h1>
       <p class="sub">${client} will be able to search, add and edit comps, listings and PCRE transactions, and read saved OPVs. It cannot delete records.</p>
       ${o.error ? `<p class="err">${esc(o.error)}</p>` : ''}
       ${o.signedIn
         ? `<form method="post">${hidden}
              <p class="sub">You're signed in to the OPV app.</p>
              <button name="action" value="allow_session">Allow access</button>
              <button name="action" value="deny" class="ghost" formnovalidate>Cancel</button>
            </form>`
         : `<form method="post">${hidden}
              <label>Username<input name="username" autocomplete="username" required autofocus></label>
              <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
              <button name="action" value="signin">Sign in and allow</button>
              <button name="action" value="deny" class="ghost" formnovalidate>Cancel</button>
            </form>`}`

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to OPV Workflow</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;
    background:#0f1117;color:#e5e7eb;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
  main{width:100%;max-width:400px;background:#1a1d27;border:1px solid #2a2d3e;border-radius:14px;padding:28px}
  .brand{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:14px}
  h1{font-size:20px;margin:0 0 8px;color:#f9fafb}
  .sub{font-size:14px;line-height:1.5;color:#9ca3af;margin:0 0 18px}
  .err{font-size:14px;color:#f87171;margin:0 0 16px}
  label{display:block;font-size:13px;color:#9ca3af;margin-bottom:14px}
  input:not([type=hidden]){display:block;width:100%;margin-top:6px;padding:10px 12px;border-radius:8px;
    border:1px solid #2a2d3e;background:#0f1117;color:#f9fafb;font-size:15px}
  input:focus{outline:2px solid #6366f1;outline-offset:1px}
  button{display:block;width:100%;padding:11px;border:0;border-radius:8px;font-size:15px;font-weight:600;
    cursor:pointer;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;margin-top:6px}
  button.ghost{background:transparent;color:#9ca3af;border:1px solid #2a2d3e;margin-top:10px;font-weight:500}
</style></head><body><main>
<div class="brand">Premier Commercial Real Estate · OPV Workflow</div>
${body}
</main></body></html>`

  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://claude.ai https://claude.com http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'; base-uri 'none'",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  })
}
