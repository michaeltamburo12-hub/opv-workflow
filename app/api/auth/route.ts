import { NextRequest, NextResponse } from 'next/server'
import { checkCredentials } from '@/lib/auth-users'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const sessionToken = process.env.AUTH_SESSION_TOKEN || ''

  if (!process.env.AUTH_USERS || !sessionToken) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
  }

  if (!checkCredentials(username, password)) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('opv_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('opv_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
