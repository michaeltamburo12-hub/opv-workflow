// Stored sale/lease dates are calendar days ("2026-01-21"). `new Date("2026-01-21")` reads that
// as midnight UTC, which is the evening before in New York, so dates showed one day early.
// Parse date-only values as a local calendar day instead.
export function parseDay(d: string | null | undefined): Date | null {
  if (!d) return null
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T00:00:00(?:\.0+)?(?:Z|[+-]00:?00)?$)/)
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d)
  return isNaN(date.getTime()) ? null : date
}

export function formatDay(
  d: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  empty = '—',
): string {
  const date = parseDay(d)
  return date ? date.toLocaleDateString('en-US', opts) : (d ? String(d) : empty)
}
