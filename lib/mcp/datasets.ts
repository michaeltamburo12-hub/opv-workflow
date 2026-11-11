// The OPV record tables as the Claude connector sees them: friendly names, column types, and
// which columns hold the town / date / price, since these differ between tables.

type ColType = 'text' | 'number' | 'date'

export type Dataset = {
  table: string
  label: string
  town: 'city' | 'town'
  date: string | null // the "when" column used for date filters and sorting
  metric?: { label: string; value: (r: Row) => number | null; columns: string[] }
  summary: string[] // columns returned by search (full row via get_record)
  columns: Record<string, ColType>
  defaults?: Record<string, unknown>
}

export type Row = Record<string, unknown>

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
const perSf = (price: string) => (r: Row) => {
  const psf = num(r.price_per_sf)
  if (psf && psf > 0) return psf
  const p = num(r[price]), sf = num(r.building_sf)
  return p && sf && sf > 0 ? Math.round((p / sf) * 100) / 100 : null
}

const BUILDING: Record<string, ColType> = {
  address: 'text', county: 'text', property_type: 'text', building_sf: 'number', lot_size_ac: 'number',
  ceiling_height: 'text', loading_docks: 'text', drive_ins: 'text', power: 'text', heat: 'text',
  parking: 'text', sprinkler: 'text', sewer: 'text', zoning: 'text', notes: 'text', status: 'text',
}

export const DATASETS = {
  sale_comps: {
    table: 'industrial_sale_comps',
    label: 'Closed industrial sale comps (Long Island)',
    town: 'city',
    date: 'sale_date',
    metric: { label: 'price per SF ($)', value: perSf('sale_price'), columns: ['price_per_sf', 'sale_price', 'building_sf'] },
    summary: ['id', 'address', 'city', 'county', 'building_sf', 'sale_price', 'price_per_sf', 'sale_date', 'ceiling_height', 'loading_docks', 'buyer', 'seller', 'sale_status'],
    columns: {
      ...BUILDING, city: 'text', state: 'text', zip_code: 'text', num_floors: 'number', column_spacing: 'text',
      real_estate_taxes: 'number', sale_price: 'number', price_per_sf: 'number', sale_date: 'date',
      sale_status: 'text', asking_price: 'number', actual_cap_rate: 'number', pro_forma_cap_rate: 'number',
      sale_type: 'text', buyer: 'text', seller: 'text', listing_broker: 'text', market: 'text', submarket: 'text',
    },
    defaults: { state: 'NY' },
  },
  sale_listings: {
    table: 'market_availabilities',
    label: 'Industrial buildings currently or previously listed for sale (market availabilities)',
    town: 'city',
    date: null,
    metric: { label: 'asking price per SF ($)', value: perSf('asking_price'), columns: ['price_per_sf', 'asking_price', 'building_sf'] },
    summary: ['id', 'address', 'city', 'county', 'building_sf', 'asking_price', 'price_per_sf', 'availability_type', 'status', 'listing_broker', 'created_at'],
    columns: {
      ...BUILDING, city: 'text', state: 'text', zip_code: 'text', real_estate_taxes: 'number', asking_price: 'number',
      price_per_sf: 'number', pricing_guidance: 'text', availability_type: 'text', listing_broker: 'text',
      submarket: 'text', market: 'text', loopnet_url: 'text',
    },
    defaults: { state: 'NY', availability_type: 'For Sale', status: 'Available' },
  },
  lease_comps: {
    table: 'lease_comps',
    label: 'Signed industrial lease comps (rents in $/SF/year)',
    town: 'town',
    date: 'transaction_date',
    metric: { label: 'rent ($/SF/yr, deal rent, else asking)', value: r => num(r.deal_rent) || num(r.asking_rent) || null, columns: ['deal_rent', 'asking_rent'] },
    summary: ['id', 'address', 'town', 'county', 'building_sf', 'deal_rent', 'asking_rent', 'rent_type', 'transaction_date', 'lease_term_years', 'tenant', 'landlord', 'status'],
    columns: {
      ...BUILDING, town: 'text', transaction_date: 'date', asking_rent: 'number', deal_rent: 'number', rent_type: 'text',
      taxes: 'number', re_taxes: 'number', lease_term_years: 'number', rent_concession_months: 'number',
      ti_ll_work: 'text', mgmt_fee_pct: 'number', tenant: 'text', landlord: 'text', escalations: 'text', office_sf: 'number',
    },
    defaults: { status: 'Active' },
  },
  lease_listings: {
    table: 'lease_market_availabilities',
    label: 'Industrial space listed for lease (asking rents in $/SF/year)',
    town: 'town',
    date: null,
    metric: { label: 'asking rent ($/SF/yr)', value: r => num(r.asking_rent), columns: ['asking_rent'] },
    summary: ['id', 'address', 'town', 'county', 'building_sf', 'asking_rent', 'rent_type', 'landlord', 'listing_broker', 'status', 'created_at'],
    columns: {
      ...BUILDING, town: 'text', asking_rent: 'number', rent_type: 'text', taxes: 'number', re_taxes: 'number',
      lease_term_years: 'number', escalations: 'text', landlord: 'text', listing_broker: 'text', loopnet_url: 'text', office_sf: 'number',
    },
    defaults: { status: 'Available' },
  },
  pcre_sales: {
    table: 'pcre_sale_transactions',
    label: "PCRE's own closed sale transactions (track record)",
    town: 'city',
    date: 'sale_date',
    summary: ['id', 'address', 'city', 'county', 'property_type', 'building_sf', 'sale_price_text', 'sale_date', 'buyer', 'seller'],
    columns: {
      address: 'text', city: 'text', county: 'text', property_type: 'text', building_sf: 'number',
      sale_price_text: 'text', sale_date: 'date', buyer: 'text', seller: 'text', notes: 'text',
    },
  },
  pcre_leases: {
    table: 'pcre_lease_transactions',
    label: "PCRE's own lease transactions (track record)",
    town: 'city',
    date: 'lease_date',
    summary: ['id', 'address', 'city', 'county', 'tenant', 'landlord', 'building_sf', 'lease_price', 'lease_date', 'lease_term'],
    columns: {
      address: 'text', city: 'text', county: 'text', tenant: 'text', landlord: 'text', building_sf: 'number',
      lease_price: 'text', lease_date: 'date', lease_term: 'text', notes: 'text',
    },
  },
} satisfies Record<string, Dataset>

export type DatasetName = keyof typeof DATASETS
export const DATASET_NAMES = Object.keys(DATASETS) as [DatasetName, ...DatasetName[]]
export const STATS_DATASETS = ['sale_comps', 'sale_listings', 'lease_comps', 'lease_listings'] as const

export const ds = (name: DatasetName): Dataset => DATASETS[name]

// ---------- value cleaning for writes ----------

function toNumber(v: unknown): number | null | undefined {
  if (v === null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v !== 'string') return undefined
  const s = v.trim().toLowerCase().replace(/[$,\s]/g, '').replace(/(sf|sq\.?ft\.?|acres?|ac|\/sf|psf|%)$/g, '')
  const m = s.match(/^(-?\d*\.?\d+)([km]?)$/)
  if (!m) return undefined
  const n = parseFloat(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1)
  return Number.isFinite(n) ? n : undefined
}

function toDate(v: unknown): string | null | undefined {
  if (v === null || v === '') return null
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (us) {
    const y = us[3].length === 2 ? `20${us[3]}` : us[3]
    return `${y}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

// Keeps known columns, converts numbers ("$1,250,000", "45,000 SF", "2.1M") and dates
// ("3/15/2024"), and reports anything it had to drop.
export function cleanValues(d: Dataset, input: Row): { values: Row; problems: string[] } {
  const values: Row = {}
  const problems: string[] = []
  for (const [k, raw] of Object.entries(input)) {
    const type = d.columns[k]
    if (!type) { problems.push(`unknown field "${k}" ignored`); continue }
    if (type === 'number') {
      const n = toNumber(raw)
      if (n === undefined) problems.push(`${k}: "${String(raw)}" is not a number, left empty`)
      values[k] = n ?? null
    } else if (type === 'date') {
      const dt = toDate(raw)
      if (dt === undefined) problems.push(`${k}: "${String(raw)}" is not a date, left empty`)
      values[k] = dt ?? null
    } else {
      values[k] = raw === null || raw === undefined ? null : String(raw).trim() || null
    }
  }
  return { values, problems }
}

// Fills price_per_sf from price / size when it wasn't given.
export function fillPricePerSf(d: Dataset, v: Row, existing: Row = {}) {
  if (!('price_per_sf' in d.columns)) return
  const priceCol = d.table === 'industrial_sale_comps' ? 'sale_price' : 'asking_price'
  const touched = priceCol in v || 'building_sf' in v
  if ('price_per_sf' in v && v.price_per_sf != null) return
  if (!touched && existing.price_per_sf != null) return
  const price = num(v[priceCol] ?? existing[priceCol])
  const sf = num(v.building_sf ?? existing.building_sf)
  if (price && sf && sf > 0) v.price_per_sf = Math.round((price / sf) * 100) / 100
}

// Normalizes an address for duplicate checks: "45 Orville Drive, Bohemia NY" -> "45 orville dr".
const ABBR: Record<string, string> = {
  street: 'st', avenue: 'ave', av: 'ave', road: 'rd', drive: 'dr', boulevard: 'blvd', lane: 'ln',
  court: 'ct', place: 'pl', parkway: 'pkwy', highway: 'hwy', turnpike: 'tpke', expressway: 'expy',
  north: 'n', south: 's', east: 'e', west: 'w', circle: 'cir', terrace: 'ter',
}
export function normalizeAddress(a: unknown): string {
  if (typeof a !== 'string') return ''
  return a.toLowerCase().split(',')[0]
    .replace(/[.#]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map(w => ABBR[w] ?? w)
    .join(' ')
}
