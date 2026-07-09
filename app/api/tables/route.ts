import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Supabase exposes OpenAPI schema at /rest/v1/ — lists all accessible tables
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Schema fetch failed: ${res.status}` }, { status: 500 })
    }

    const schema = await res.json()

    // OpenAPI 2.0: table names are keys in `definitions`
    const definitions = schema?.definitions || {}
    const tables = Object.keys(definitions)
      .filter(n => !n.startsWith('_') && !n.includes('.'))
      .sort()

    // Fallback: if schema is empty, return known tables
    if (!tables.length) {
      return NextResponse.json({ tables: ['industrial_sale_comps', 'lease_comps', 'market_availabilities'] })
    }

    return NextResponse.json({ tables })
  } catch (e) {
    // Always return at least the known tables so the UI doesn't get stuck
    return NextResponse.json({ tables: ['industrial_sale_comps', 'lease_comps', 'market_availabilities'] })
  }
}
