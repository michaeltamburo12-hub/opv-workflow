import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  // AUTH_USERS format: "user1:pass1,user2:pass2"
  const rawUsers = process.env.AUTH_USERS || ''
  const sessionToken = process.env.AUTH_SESSION_TOKEN || ''

  if (!rawUsers || !sessionToken) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
  }

  const users = rawUsers.split(',').map(u => {
    const [un, pw] = u.trim().split(':')
    return { username: un, password: pw }
  })

  const match = users.find(u => u.username === username && u.password === password)

  if (!match) {
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
