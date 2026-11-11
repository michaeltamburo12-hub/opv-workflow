import { NextRequest, NextResponse } from 'next/server'
import { allowedRedirectUri, noStore, now, sign } from '@/lib/mcp/oauth'

// Dynamic client registration (RFC 7591). Claude registers itself here when a user adds the
// connector. The client id is a signed record of the allowed redirect URIs — nothing is stored.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('invalid_client_metadata', 'Body must be JSON') }

  const uris = body.redirect_uris
  if (!Array.isArray(uris) || !uris.length || uris.length > 10) return err('invalid_redirect_uri', 'redirect_uris is required')
  if (!uris.every(allowedRedirectUri)) return err('invalid_redirect_uri', 'Only Claude and local redirect URIs are allowed')

  const name = typeof body.client_name === 'string' ? body.client_name.slice(0, 80) : 'Claude'
  const client_id = sign({ typ: 'client', r: uris as string[], n: name })

  return NextResponse.json({
    client_id,
    client_id_issued_at: now(),
    client_name: name,
    redirect_uris: uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }, { status: 201, headers: noStore })
}

const err = (error: string, error_description: string) =>
  NextResponse.json({ error, error_description }, { status: 400, headers: noStore })
