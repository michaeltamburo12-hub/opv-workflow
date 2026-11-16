// The OPV value analysis, shared by the app's Analytics step and the Claude connector so both
// produce the same numbers.
//
// Outliers: a comp or listing counts as an outlier when its $/SF (or rent, for lease comps) is
// more than 2.5x the median of the group, or less than 40% of it (see lib/stats.ts). Outliers are
// left out of every average and of the value range, and named so someone can check the record.
import { pricePerSf } from './format'
import { splitOutliers, OUTLIER_HIGH, OUTLIER_LOW } from './stats'

export type Outlier = { address: string; psf: number }

export type AnalyticsResult = {
  mean: number; median: number; std: number; weighted: number; min: number; max: number
  low: number; market: number; high: number; suggested: number
  aMean: number; aOutliers: Outlier[]; compOutliers: Outlier[]; count: number
  leaseMeanDeal?: number; leaseMedianDeal?: number; leaseMeanAsk?: number; leaseCount?: number
  leaseMin?: number; leaseMax?: number; leaseSuggested?: number; leaseOutliers?: Outlier[]
}

type R = Record<string, unknown>
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
const sd = (xs: number[]) => { const m = avg(xs); return xs.length ? Math.sqrt(avg(xs.map(p => (p - m) ** 2))) : 0 }
const addr = (r: R) => String(r.address ?? '')

export const OUTLIER_RULE =
  `An outlier is a comp or listing whose $/SF is more than ${OUTLIER_HIGH}x the median of the group, or less than ${Math.round(OUTLIER_LOW * 100)}% of it. ` +
  `That is usually a typo in the price or building size. Outliers are left out of the averages and the value range.`

function saleStats(comps: R[]) {
  const split = splitOutliers(comps.map(c => ({ item: c, value: pricePerSf(c) })))
  const kept = split.kept
  const psfs = kept.map(x => x.value)
  const mean = avg(psfs), std = sd(psfs)
  const sized = kept.filter(x => n(x.item.building_sf) > 0)
  const totalSF = sized.reduce((a, x) => a + n(x.item.building_sf), 0)
  const weighted = totalSF > 0 ? sized.reduce((a, x) => a + x.value * n(x.item.building_sf), 0) / totalSF : mean
  return {
    psfs, mean, median: med(psfs), std, weighted,
    min: psfs.length ? Math.min(...psfs) : 0, max: psfs.length ? Math.max(...psfs) : 0,
    compOutliers: split.outliers.map(x => ({ address: addr(x.item), psf: x.value })),
  }
}

function listingStats(avails: R[]) {
  const split = splitOutliers(avails.map(a => ({ item: a, value: pricePerSf(a) })))
  return { aMean: avg(split.kept.map(x => x.value)), aOutliers: split.outliers.map(x => ({ address: addr(x.item), psf: x.value })) }
}

// Returns an error message instead of a result when there isn't enough data.
export function computeAnalytics(opts: { isLease: boolean; comps: R[]; avails: R[]; leaseComps: R[] }): AnalyticsResult | string {
  const { isLease, comps, avails, leaseComps } = opts
  const s = saleStats(comps)
  const l = listingStats(avails)
  if (isLease) {
    const dealSplit = splitOutliers(leaseComps.map(c => ({ item: c, value: n(c.deal_rent) })))
    const dealRents = dealSplit.kept.map(x => x.value)
    if (!dealRents.length) return 'Add lease comps with deal rent values first. Without deal rents the lease analysis cannot be calculated.'
    const askRents = leaseComps.map(c => n(c.asking_rent)).filter(v => v > 0)
    const leaseMeanAsk = avg(askRents)
    const leaseMin = Math.min(...dealRents), leaseMax = Math.max(...dealRents)
    return {
      mean: s.mean, median: s.median, std: s.std, weighted: s.weighted, min: s.min, max: s.max,
      low: s.mean - s.std * 0.5, market: s.mean, high: s.mean + s.std * 0.5, suggested: s.mean ? Math.round(s.mean * 1.05 / 5) * 5 : 0,
      ...l, compOutliers: s.compOutliers, count: s.psfs.length,
      leaseMeanDeal: avg(dealRents), leaseMedianDeal: med(dealRents), leaseMeanAsk, leaseCount: dealRents.length, leaseMin, leaseMax,
      leaseSuggested: leaseMeanAsk > 0 ? Math.round(leaseMeanAsk * 1.05 * 4) / 4 : leaseMax > 0 ? Math.round(leaseMax * 1.05 * 4) / 4 : 0,
      leaseOutliers: dealSplit.outliers.map(x => ({ address: addr(x.item), psf: x.value })),
    }
  }
  if (!s.psfs.length) return 'Add comps with sale prices first.'
  const low = s.mean - s.std * 0.5, market = s.mean, high = s.mean + s.std * 0.5
  return {
    mean: s.mean, median: s.median, std: s.std, weighted: s.weighted, min: s.min, max: s.max,
    low, market, high, suggested: Math.round(market * 1.05 / 5) * 5,
    ...l, compOutliers: s.compOutliers, count: s.psfs.length,
  }
}
