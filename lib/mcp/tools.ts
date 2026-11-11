import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { supabaseAdmin as sb } from '@/lib/supabase-server'
import {
  DATASETS, DATASET_NAMES, STATS_DATASETS, DatasetName, Row,
  cleanValues, ds, fillPricePerSf, normalizeAddress,
} from './datasets'

// The Claude connector's actions. Deliberately no delete: removing records stays in the app.

const INSTRUCTIONS = `This is the OPV Workflow database of Premier Commercial Real Estate (PCRE), an industrial real estate brokerage on Long Island, NY (Nassau and Suffolk counties). It holds sale comps, lease comps, for-sale and for-lease listings, PCRE's own closed transactions, and saved OPVs (opinions of value).

- Prices are US dollars; price_per_sf is $/SF; rents are $/SF/year.
- Before adding or changing records, show the user what you'll write and get their OK. create_records checks for duplicates by address; if one exists, offer update_record instead.
- When adding records from a file or email, map its fields onto the dataset's fields (see describe_datasets) and put anything that doesn't fit in notes.
- Records cannot be deleted through this connector; tell the user to delete in the OPV app.`

type Json = Record<string, unknown> | unknown[]
const ok = (data: Json) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 1) }] })
const fail = (message: string) => ({ isError: true, content: [{ type: 'text' as const, text: message }] })

const datasetArg = z.enum(DATASET_NAMES).describe(
  'Which records: ' + DATASET_NAMES.map(n => `${n} = ${DATASETS[n].label}`).join('; '),
)
const uuid = z.string().uuid()

// Strip characters that have meaning in PostgREST filter syntax.
const safe = (s: string) => s.replace(/[,()*%\\]/g, ' ').trim()

const PAGE = 1000
const MAX_SCAN = 20000

// Reads every matching row (in pages) — used for stats and duplicate checks. Tables are small.
async function fetchAll(table: string, columns: string, apply: (q: any) => any = q => q): Promise<Row[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: Row[] = []
  for (let from = 0; from < MAX_SCAN; from += PAGE) {
    const { data, error } = await apply(sb.from(table).select(columns)).order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data as Row[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

type Filters = {
  town?: string; county?: string; address?: string; text?: string
  min_sf?: number; max_sf?: number; date_from?: string; date_to?: string; status?: string
}

const filterArgs = {
  town: z.string().optional().describe('Town / city name, partial match (e.g. "Hauppauge")'),
  county: z.enum(['Nassau', 'Suffolk']).optional(),
  min_sf: z.number().optional().describe('Minimum building size in SF'),
  max_sf: z.number().optional().describe('Maximum building size in SF'),
  date_from: z.string().optional().describe('Earliest sale/lease date, YYYY-MM-DD (datasets with a date only)'),
  date_to: z.string().optional().describe('Latest sale/lease date, YYYY-MM-DD'),
}

function applyFilters(name: DatasetName, f: Filters) {
  const d = ds(name)
  return (q: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (f.town) q = q.ilike(d.town, `%${safe(f.town)}%`)
    if (f.county) q = q.ilike('county', safe(f.county))
    if (f.address) q = q.ilike('address', `%${safe(f.address)}%`)
    if (f.status && 'status' in d.columns) q = q.ilike('status', safe(f.status))
    if (f.min_sf != null) q = q.gte('building_sf', f.min_sf)
    if (f.max_sf != null) q = q.lte('building_sf', f.max_sf)
    if (d.date && f.date_from) q = q.gte(d.date, f.date_from)
    if (d.date && f.date_to) q = q.lte(d.date, f.date_to)
    if (f.text) {
      const t = safe(f.text)
      const cols = ['address', 'notes', 'buyer', 'seller', 'tenant', 'landlord', 'listing_broker', 'zoning', 'property_type']
        .filter(c => c in d.columns)
      if (t) q = q.or(cols.map(c => `${c}.ilike.*${t}*`).join(','))
    }
    return q
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round = (n: number | null, dp = 2) => (n == null ? null : Math.round(n * 10 ** dp) / 10 ** dp)
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
const sizeBand = (sf: number | null) =>
  sf == null ? 'unknown' : sf < 10000 ? 'under 10k SF' : sf < 25000 ? '10k–25k SF' : sf < 50000 ? '25k–50k SF' : sf < 100000 ? '50k–100k SF' : '100k+ SF'

function logWrite(sub: string, action: string, dataset: string, ids: string[]) {
  console.log(JSON.stringify({ event: 'mcp_write', via: 'claude-connector', user: sub, action, dataset, ids }))
}

export function buildServer(user: { sub: string }) {
  const server = new McpServer(
    { name: 'opv-workflow', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  )

  server.registerTool('describe_datasets', {
    title: 'Describe datasets',
    description: 'Lists the OPV datasets, what each holds, record counts, and every field with its type. Use before creating records or when unsure which fields exist.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => {
    const out: Record<string, unknown> = {}
    for (const name of DATASET_NAMES) {
      const d = ds(name)
      const { count } = await sb.from(d.table).select('id', { count: 'exact', head: true })
      out[name] = { description: d.label, records: count, town_field: d.town, date_field: d.date, fields: d.columns }
    }
    out.opvs = { description: 'Saved OPVs (opinions of value). Use list_opvs / get_opv. Read-only here.' }
    return ok(out)
  })

  server.registerTool('search_records', {
    title: 'Search records',
    description: 'Finds records in one dataset by town, county, size, date, address or free text. Returns key fields; use get_record for every field.',
    inputSchema: {
      dataset: datasetArg,
      ...filterArgs,
      address: z.string().optional().describe('Address contains (e.g. "Oser Ave")'),
      text: z.string().optional().describe('Free text matched against address, notes, buyer/seller, tenant/landlord, broker, zoning'),
      status: z.string().optional().describe('Exact status, e.g. Available, Sold, Under Contract, Active'),
      sort: z.enum(['newest', 'oldest', 'largest', 'smallest', 'price_high', 'price_low']).optional().describe('Default newest'),
      limit: z.number().int().min(1).max(200).optional().describe('Default 25'),
      offset: z.number().int().min(0).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (a) => {
    const d = ds(a.dataset)
    const limit = a.limit ?? 25, offset = a.offset ?? 0
    let q = applyFilters(a.dataset, a)(sb.from(d.table).select(d.summary.join(','), { count: 'exact' }))
    const priceCol = d.metric?.columns[0]
    const dateCol = d.date ?? 'created_at'
    switch (a.sort ?? 'newest') {
      case 'oldest': q = q.order(dateCol, { ascending: true, nullsFirst: false }); break
      case 'largest': q = q.order('building_sf', { ascending: false, nullsFirst: false }); break
      case 'smallest': q = q.order('building_sf', { ascending: true, nullsFirst: false }); break
      case 'price_high': q = priceCol ? q.order(priceCol, { ascending: false, nullsFirst: false }) : q; break
      case 'price_low': q = priceCol ? q.order(priceCol, { ascending: true, nullsFirst: false }) : q; break
      default: q = q.order(dateCol, { ascending: false, nullsFirst: false })
    }
    const { data, error, count } = await q.order('id').range(offset, offset + limit - 1)
    if (error) return fail(error.message)
    return ok({ dataset: a.dataset, total_matches: count, returned: data?.length ?? 0, offset, records: data })
  })

  server.registerTool('get_record', {
    title: 'Get record',
    description: 'Returns every field of one record by id.',
    inputSchema: { dataset: datasetArg, id: uuid },
    annotations: { readOnlyHint: true },
  }, async (a) => {
    const { data, error } = await sb.from(ds(a.dataset).table).select('*').eq('id', a.id).maybeSingle()
    if (error) return fail(error.message)
    if (!data) return fail(`No ${a.dataset} record with id ${a.id}`)
    return ok(data)
  })

  server.registerTool('market_stats', {
    title: 'Market stats',
    description: 'Counts and price/rent statistics (median, average, range, average size) for comps or listings matching filters, optionally grouped by town, county, year or size band. Sale datasets use $/SF; lease datasets use $/SF/yr. Values far from the median are reported as likely_data_errors and left out of the average; mention them to the user.',
    inputSchema: {
      dataset: z.enum(STATS_DATASETS),
      ...filterArgs,
      group_by: z.enum(['town', 'county', 'year', 'size_band']).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (a) => {
    const d = ds(a.dataset)
    const metric = d.metric!
    if (a.group_by === 'year' && !d.date) return fail(`${a.dataset} has no date field; group by town, county or size_band instead`)
    const cols = Array.from(new Set(['id', 'address', d.town, 'county', 'building_sf', ...metric.columns, ...(d.date ? [d.date] : [])]))
    let rows: Row[]
    try { rows = await fetchAll(d.table, cols.join(','), applyFilters(a.dataset, a)) } catch (e) { return fail((e as Error).message) }

    // Values more than 5x away from the median are almost always data-entry errors (a total
    // price typed into $/SF, a missing zero). Report them separately instead of letting them
    // skew the average, so the user can fix them.
    const summarize = (rs: Row[], listOutliers = false) => {
      const priced = rs.map(r => ({ r, v: metric.value(r) })).filter((x): x is { r: Row; v: number } => x.v != null && x.v > 0)
      const med = median(priced.map(x => x.v))
      const isOut = (v: number) => med != null && (v > med * 5 || v < med / 5)
      const good = priced.filter(x => !isOut(x.v)).map(x => x.v)
      const out = priced.filter(x => isOut(x.v))
      const sfs = rs.map(r => Number(r.building_sf)).filter(v => v > 0)
      return {
        records: rs.length,
        with_price: priced.length,
        median: round(med),
        average: round(good.length ? good.reduce((s, v) => s + v, 0) / good.length : null),
        min: round(good.length ? Math.min(...good) : null),
        max: round(good.length ? Math.max(...good) : null),
        avg_building_sf: sfs.length ? Math.round(sfs.reduce((s, v) => s + v, 0) / sfs.length) : null,
        ...(out.length ? { likely_data_errors: listOutliers
          ? { count: out.length, note: 'excluded from average/min/max', records: out.slice(0, 15).map(x => ({ id: x.r.id, address: x.r.address, value: round(x.v) })) }
          : out.length } : {}),
      }
    }

    const result: Record<string, unknown> = { dataset: a.dataset, metric: metric.label, overall: summarize(rows, true) }
    if (a.group_by) {
      const key = (r: Row): string => {
        switch (a.group_by) {
          case 'town': return r[d.town] ? titleCase(String(r[d.town]).trim()) : 'unknown'
          case 'county': return r.county ? String(r.county) : 'unknown'
          case 'year': return r[d.date!] ? String(r[d.date!]).slice(0, 4) : 'unknown'
          default: return sizeBand(r.building_sf == null ? null : Number(r.building_sf))
        }
      }
      const groups = new Map<string, Row[]>()
      for (const r of rows) { const k = key(r); groups.set(k, [...(groups.get(k) ?? []), r]) }
      result.groups = Array.from(groups, ([group, rs]) => ({ group, ...summarize(rs) }))
        .sort((x, y) => (a.group_by === 'year' ? y.group.localeCompare(x.group) : y.records - x.records))
        .slice(0, 60)
    }
    return ok(result)
  })

  server.registerTool('create_records', {
    title: 'Add records',
    description: 'Adds one or more records (up to 200) to a dataset, e.g. comps pulled from a flyer, email, PDF or spreadsheet. Field names must match describe_datasets; numbers like "$1,250,000" or "45,000 SF" and dates like "3/15/2024" are converted. Records whose address (and date, for comps) already exists are skipped and reported unless skip_duplicates is false. Confirm with the user before calling.',
    inputSchema: {
      dataset: datasetArg,
      records: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
      skip_duplicates: z.boolean().optional().describe('Default true'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (a) => {
    const d = ds(a.dataset)
    const skipDupes = a.skip_duplicates ?? true

    let existing: Row[] = []
    try { existing = await fetchAll(d.table, ['id', 'address', ...(d.date ? [d.date] : [])].join(',')) } catch (e) { return fail((e as Error).message) }
    const seen = new Map<string, Row[]>()
    for (const r of existing) {
      const k = normalizeAddress(r.address)
      if (k) seen.set(k, [...(seen.get(k) ?? []), r])
    }

    const toInsert: Row[] = [], skipped: unknown[] = [], warnings: unknown[] = []
    a.records.forEach((input, i) => {
      const { values, problems } = cleanValues(d, input)
      if (!values.address) { skipped.push({ index: i, reason: 'missing address' }); return }
      const matches = seen.get(normalizeAddress(values.address)) ?? []
      const dupes = d.date && values[d.date]
        ? matches.filter(m => !m[d.date!] || m[d.date!] === values[d.date!])
        : matches
      if (dupes.length && skipDupes) {
        const inBatch = dupes.find(m => typeof m._batchIndex === 'number')
        skipped.push(inBatch
          ? { index: i, address: values.address, reason: `same as record ${inBatch._batchIndex} in this batch` }
          : { index: i, address: values.address, reason: 'already in database', existing_ids: dupes.map(m => m.id) })
        return
      }
      fillPricePerSf(d, values)
      toInsert.push({ ...(d.defaults ?? {}), ...values })
      if (problems.length) warnings.push({ index: i, address: values.address, problems })
      seen.set(normalizeAddress(values.address), [...matches, { ...values, _batchIndex: i }]) // catch duplicates within the batch
    })

    const created: Row[] = []
    for (let i = 0; i < toInsert.length; i += 100) {
      const { data, error } = await sb.from(d.table).insert(toInsert.slice(i, i + 100)).select('id,address')
      if (error) return fail(`Saved ${created.length} of ${toInsert.length} before an error: ${error.message}`)
      created.push(...(data as Row[]))
    }
    if (created.length) logWrite(user.sub, 'create', a.dataset, created.map(r => String(r.id)))
    return ok({ dataset: a.dataset, created: created.length, records: created, skipped, warnings })
  })

  server.registerTool('update_record', {
    title: 'Edit record',
    description: 'Changes fields on one record by id. Only the fields given are changed; set a field to null to clear it. Returns the before and after values. Confirm with the user before calling.',
    inputSchema: {
      dataset: datasetArg,
      id: uuid,
      changes: z.record(z.string(), z.unknown()),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  }, async (a) => {
    const d = ds(a.dataset)
    const { data: before, error: e1 } = await sb.from(d.table).select('*').eq('id', a.id).maybeSingle()
    if (e1) return fail(e1.message)
    if (!before) return fail(`No ${a.dataset} record with id ${a.id}`)

    const { values, problems } = cleanValues(d, a.changes)
    fillPricePerSf(d, values, before as Row)
    if (!Object.keys(values).length) return fail('Nothing to change. ' + problems.join('; '))

    const { data: after, error: e2 } = await sb.from(d.table).update(values).eq('id', a.id).select('*').single()
    if (e2) return fail(e2.message)
    logWrite(user.sub, 'update', a.dataset, [a.id])

    const changed: Record<string, { before: unknown; after: unknown }> = {}
    for (const k of Object.keys(values)) changed[k] = { before: (before as Row)[k], after: (after as Row)[k] }
    return ok({ dataset: a.dataset, id: a.id, address: (after as Row).address, changed, warnings: problems })
  })

  server.registerTool('list_opvs', {
    title: 'List saved OPVs',
    description: 'Lists saved OPVs (opinions of value), most recently updated first.',
    inputSchema: {
      address: z.string().optional().describe('Subject address contains'),
      limit: z.number().int().min(1).max(100).optional().describe('Default 20'),
    },
    annotations: { readOnlyHint: true },
  }, async (a) => {
    let q = sb.from('opv_reports').select('id,address,saved_by,current_step,created_at,updated_at', { count: 'exact' })
    if (a.address) q = q.ilike('address', `%${safe(a.address)}%`)
    const { data, error, count } = await q.order('updated_at', { ascending: false, nullsFirst: false }).limit(a.limit ?? 20)
    if (error) return fail(error.message)
    return ok({ total: count, opvs: data })
  })

  server.registerTool('get_opv', {
    title: 'Open saved OPV',
    description: 'Returns a saved OPV: subject property, assignment, selected sale and lease comps, availabilities, analytics and AI text.',
    inputSchema: { id: uuid },
    annotations: { readOnlyHint: true },
  }, async (a) => {
    const { data, error } = await sb.from('opv_reports')
      .select('id,address,saved_by,current_step,created_at,updated_at,subject_json,assignment_json,comps_json,lease_comps_json,avails_json,lease_avails_json,analytics_json,ai_text')
      .eq('id', a.id).maybeSingle()
    if (error) return fail(error.message)
    if (!data) return fail(`No OPV with id ${a.id}`)
    const parse = (s: unknown) => { if (typeof s !== 'string' || !s) return null; try { return JSON.parse(s) } catch { return s } }
    const slim = (list: unknown, keys: string[]) => Array.isArray(list)
      ? list.map((r: Row) => Object.fromEntries(keys.filter(k => r[k] != null && r[k] !== '').map(k => [k, r[k]])))
      : list
    const r = data as Row
    return ok({
      id: r.id, address: r.address, saved_by: r.saved_by, current_step: r.current_step,
      created_at: r.created_at, updated_at: r.updated_at,
      subject: parse(r.subject_json),
      assignment: parse(r.assignment_json),
      sale_comps: slim(parse(r.comps_json), ['id', ...DATASETS.sale_comps.summary.slice(1), 'lot_size_ac', 'notes']),
      lease_comps: slim(parse(r.lease_comps_json), ['id', ...DATASETS.lease_comps.summary.slice(1), 'notes']),
      sale_listings: slim(parse(r.avails_json), ['id', ...DATASETS.sale_listings.summary.slice(1)]),
      lease_listings: slim(parse(r.lease_avails_json), ['id', ...DATASETS.lease_listings.summary.slice(1)]),
      analytics: parse(r.analytics_json),
      ai_text: r.ai_text,
    })
  })

  return server
}
