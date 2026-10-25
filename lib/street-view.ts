// Google Street View / satellite imagery for an address. Used by /api/street-view (browser)
// and by the Word export (server-side, so photos don't have to be uploaded from the browser).

export type StreetViewImage = { buffer: ArrayBuffer, contentType: string, source: 'streetview' | 'satellite' }

export async function fetchStreetViewImage(address: string, mode: 'auto' | 'satellite' = 'auto'): Promise<StreetViewImage | null> {
  const key = process.env.GOOGLE_MAPS_KEY
  if (!key) throw new Error('GOOGLE_MAPS_KEY not configured')

  const encoded = encodeURIComponent(address)
  const satelliteUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encoded}&zoom=18&size=800x500&maptype=satellite&markers=color:red%7C${encoded}&key=${key}`
  const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x500&location=${encoded}&key=${key}&return_error_code=true`

  const get = async (url: string, source: StreetViewImage['source']): Promise<StreetViewImage | null> => {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    return { buffer: await res.arrayBuffer(), contentType: res.headers.get('Content-Type') || 'image/jpeg', source }
  }

  // Default: try Street View first, fall back to satellite
  if (mode !== 'satellite') {
    const sv = await get(streetViewUrl, 'streetview')
    if (sv) return sv
  }
  return get(satelliteUrl, 'satellite')
}
