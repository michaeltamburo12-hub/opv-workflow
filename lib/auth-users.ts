// The app's current shared logins: AUTH_USERS = "user1:pass1,user2:pass2".
// Used by the app login (/api/auth) and the Claude connector sign-in (/api/oauth/authorize).
export function checkCredentials(username: unknown, password: unknown): string | null {
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) return null
  const users = (process.env.AUTH_USERS || '').split(',').map(u => {
    const [un, ...rest] = u.trim().split(':')
    return { username: un, password: rest.join(':') }
  })
  const match = users.find(u => u.username && u.username === username && u.password === password)
  return match ? match.username : null
}
