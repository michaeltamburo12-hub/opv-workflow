import type { NextRequest } from 'next/server'

// True when the request carries a valid app session cookie (set by /api/auth on login).
// middleware.ts already guards every route, but routes that touch the database check again
// so they stay protected even if the middleware matcher changes.
export function hasSession(req: NextRequest): boolean {
  const token = process.env.AUTH_SESSION_TOKEN
  const session = req.cookies.get('opv_session')?.value
  return !!token && !!session && session === token
}
