export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { fetchStreetViewImage, StreetViewError } from '@/lib/street-view'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  const mode    = req.nextUrl.searchParams.get('mode') // 'streetview' | 'satellite' | 'auto' (default)
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })
  if (!process.env.GOOGLE_MAPS_KEY) return NextResponse.json({ error: 'GOOGLE_MAPS_KEY not configured' }, { status: 500 })

  try {
    const img = await fetchStreetViewImage(address, mode === 'satellite' ? 'satellite' : 'auto')
    if (!img) return NextResponse.json({ error: mode === 'satellite' ? 'Satellite map unavailable' : 'No imagery available' }, { status: mode === 'satellite' ? 502 : 404 })
    return new NextResponse(img.buffer, {
      headers: {
        'Content-Type': img.contentType,
        'Cache-Control': 'public, max-age=86400',
        'X-Image-Source': img.source,
      },
    })
  } catch (e) {
    // Google refusals (disabled API, billing, key restrictions) come back as 502 with Google's reason
    if (e instanceof StreetViewError) return NextResponse.json({ error: 'Google refused the image request', google: e.message }, { status: 502 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
