export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  const key = process.env.GOOGLE_MAPS_KEY
  if (!key) return NextResponse.json({ error: 'GOOGLE_MAPS_KEY not configured' }, { status: 500 })

  const encoded = encodeURIComponent(address)
  const url = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encoded}&key=${key}&return_error_code=true`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      return NextResponse.json({ error: `Street View returned ${res.status}` }, { status: 502 })
    }
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
