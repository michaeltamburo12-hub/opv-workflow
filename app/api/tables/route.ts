import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Use PostgREST to query pg_tables — works with service role key
    const res = await fetch(`${url}/rest/v1/pg_tables?select=tablename&schemaname=eq.public`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: 500 })
    }

    const data: Array<{ tablename: string }> = await res.json()
    const tables = data
      .map(t => t.tablename)
      .filter(n => !n.startsWith('_') && !n.startsWith('pg_') && n !== 'spatial_ref_sys')
      .sort()

    return NextResponse.json({ tables })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
