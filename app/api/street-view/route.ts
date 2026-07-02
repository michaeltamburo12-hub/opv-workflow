export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  const mode    = req.nextUrl.searchParams.get('mode') // 'streetview' | 'satellite' | 'auto' (default)
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  const key = process.env.GOOGLE_MAPS_KEY
  if (!key) return NextResponse.json({ error: 'GOOGLE_MAPS_KEY not configured' }, { status: 500 })

  const encoded = encodeURIComponent(address)

  // Helper to proxy an image URL
  const proxyImage = async (url: string) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  }

  const satelliteUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encoded}&zoom=18&size=800x500&maptype=satellite&markers=color:red%7C${encoded}&key=${key}`
  const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x500&location=${encoded}&key=${key}&return_error_code=true`

  try {
    if (mode === 'satellite') {
      const img = await proxyImage(satelliteUrl)
      if (img) return img
      return NextResponse.json({ error: 'Satellite map unavailable' }, { status: 502 })
    }

    // Default: try Street View first, fall back to satellite
    const svRes = await fetch(streetViewUrl, { signal: AbortSignal.timeout(10000) })
    if (svRes.ok) {
      const buffer = await svRes.arrayBuffer()
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': svRes.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
          'X-Image-Source': 'streetview',
        },
      })
    }

    // Street View unavailable — fall back to satellite
    const img = await proxyImage(satelliteUrl)
    if (img) return img

    return NextResponse.json({ error: 'No imagery available' }, { status: 404 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
