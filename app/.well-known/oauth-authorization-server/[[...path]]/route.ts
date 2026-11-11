import { NextRequest, NextResponse } from 'next/server'
import { origin } from '@/lib/mcp/oauth'

// OAuth authorization server metadata for the Claude connector (RFC 8414).
export function GET(req: NextRequest) {
  const o = origin(req)
  return NextResponse.json({
    issuer: o,
    authorization_endpoint: `${o}/api/oauth/authorize`,
    token_endpoint: `${o}/api/oauth/token`,
    registration_endpoint: `${o}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['opv'],
  })
}
