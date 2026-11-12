// Splits $/SF values into typical ones and likely data errors (a price typed with an extra zero, a
// building size missing one). A value counts as an outlier when it is more than 2.5x the median or
// less than 40% of it. Needs at least 3 values to judge; with fewer, nothing is flagged.
export const OUTLIER_HIGH = 2.5
export const OUTLIER_LOW = 0.4

export type Valued<T> = { item: T; value: number }

export function splitOutliers<T>(rows: Valued<T>[]): { kept: Valued<T>[]; outliers: Valued<T>[] } {
  const priced = rows.filter(r => Number.isFinite(r.value) && r.value > 0)
  if (priced.length < 3) return { kept: priced, outliers: [] }
  const sorted = priced.map(r => r.value).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const isOut = (v: number) => v > median * OUTLIER_HIGH || v < median * OUTLIER_LOW
  return { kept: priced.filter(r => !isOut(r.value)), outliers: priced.filter(r => isOut(r.value)) }
}
