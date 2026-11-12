// Shared number formatting for the app and the report exports.

const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

// Lot size in acres, at most two decimals ("0.30000000000000004" -> "0.3", "2.456" -> "2.46").
// Free text that isn't a plain number ("2.1 acres", "irregular") is left as typed.
export function acres(v: unknown): string {
  const n = toNum(v)
  if (n == null) return v == null ? '' : String(v).replace(/\s*(acres?|ac)\.?\s*$/i, '')
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

// Dollar amount with exactly two decimals: 26997.2 -> "$26,997.20".
export function money2(v: unknown): string {
  const n = toNum(v)
  if (n == null) return v == null ? '' : String(v)
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Price per SF, calculated from the price and building size whenever both are known, so it can't
// drift from them. The stored price_per_sf is only a fallback (e.g. no size on file).
// Works for sale comps (sale_price) and sale listings (asking_price).
export function pricePerSf(r: { price_per_sf?: unknown; sale_price?: unknown; asking_price?: unknown; building_sf?: unknown } | null | undefined): number {
  if (!r) return 0
  const price = toNum(r.sale_price) ?? toNum(r.asking_price)
  const sf = toNum(r.building_sf)
  if (price && price > 0 && sf && sf > 0) return Math.round((price / sf) * 100) / 100
  return toNum(r.price_per_sf) ?? 0
}

// Same record with price_per_sf set from pricePerSf(). Leaves records with no price data alone.
export function withPricePerSf<T extends object>(r: T): T {
  const psf = pricePerSf(r as Parameters<typeof pricePerSf>[0])
  return psf ? { ...r, price_per_sf: psf } : r
}

// Clear height, which may be a single number ("22", "22'", "22 ft") or a range ("14-16", "14' to 16'").
// style 'ft' -> "22 ft" / "14–16 ft"; style 'clear' -> "22' clear" / "14'–16' clear".
// Anything else (e.g. "TBD") is shown as typed.
export function clearHeight(v: unknown, style: 'ft' | 'clear' = 'ft'): string {
  if (v == null || v === '') return ''
  const s = String(v).trim()
  const num = String.raw`(\d+(?:\.\d+)?)\s*(?:'|ft\.?|feet)?`
  const range = s.match(new RegExp(String.raw`^${num}\s*(?:-|–|—|to)\s*${num}\s*(?:clear)?$`, 'i'))
  if (range) return style === 'ft' ? `${range[1]}–${range[2]} ft` : `${range[1]}'–${range[2]}' clear`
  const single = s.match(new RegExp(String.raw`^${num}\s*(?:clear)?$`, 'i'))
  if (single) return style === 'ft' ? `${single[1]} ft` : `${single[1]}' clear`
  return s
}

// Report sentence about docks/drive-ins. Blank, "0" or "none" reads as "no", never as a placeholder.
const countWord = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  if (/^(0+|none|n\/?a|no)$/i.test(s)) return 'no'
  return s
}
export function docksSentence(docks: unknown, driveIns: unknown): string | null {
  const d = countWord(docks), di = countWord(driveIns)
  if (d == null && di == null) return null
  const plural = (n: string, one: string, many: string) => (n === '1' ? one : many)
  const parts: string[] = []
  if (d != null) parts.push(`${d} ${plural(d, 'loading dock', 'loading docks')}`)
  if (di != null) parts.push(`${di} ${plural(di, 'drive-in door', 'drive-in doors')}`)
  const s = parts.join(' and ')
  return s.charAt(0).toUpperCase() + s.slice(1) + '.'
}

// Report sentence about the sprinkler system ("None" -> "No sprinkler system.").
export function sprinklerSentence(v: unknown): string | null {
  const s = v == null ? '' : String(v).trim()
  if (!s) return null
  if (/^(none|no|n\/?a)$/i.test(s)) return 'No sprinkler system.'
  return `${s} sprinkler system.`
}
