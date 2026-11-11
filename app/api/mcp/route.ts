export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticate, resourceMetadataUrl } from '@/lib/mcp/oauth'
import { buildServer } from '@/lib/mcp/tools'

// The Claude connector (remote MCP server, Streamable HTTP, stateless).
// Each request carries an OAuth access token from /api/oauth/token; without one we answer 401
// with a pointer to the OAuth metadata, which is how Claude knows to start the sign-in flow.

function unauthorized(req: NextRequest) {
  return NextResponse.json(
    { error: 'invalid_token', error_description: 'Sign in required' },
    { status: 401, headers: { 'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl(req)}"` } },
  )
}

export async function POST(req: NextRequest) {
  const user = authenticate(req)
  if (!user) return unauthorized(req)

  const server = buildServer(user)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no sessions to keep between serverless invocations
    enableJsonResponse: true,
  })
  await server.connect(transport)
  try {
    return await transport.handleRequest(req)
  } finally {
    void server.close()
  }
}

// Stateless server: no server-initiated stream (GET) or session to end (DELETE).
export async function GET(req: NextRequest) {
  if (!authenticate(req)) return unauthorized(req)
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
export async function DELETE(req: NextRequest) {
  if (!authenticate(req)) return unauthorized(req)
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
