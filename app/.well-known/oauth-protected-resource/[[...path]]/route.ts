import { NextRequest, NextResponse } from 'next/server'
import { origin, resourceUrl } from '@/lib/mcp/oauth'

// OAuth protected resource metadata for the Claude connector (RFC 9728).
// Served at /.well-known/oauth-protected-resource and /.well-known/oauth-protected-resource/api/mcp.
export function GET(req: NextRequest) {
  return NextResponse.json({
    resource: resourceUrl(req),
    authorization_servers: [origin(req)],
    bearer_methods_supported: ['header'],
    scopes_supported: ['opv'],
    resource_name: 'OPV Workflow',
  })
}
