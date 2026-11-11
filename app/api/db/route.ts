export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hasSession } from '@/lib/session'

// Server-side gateway for the browser's database reads and writes.
// The browser used to query Supabase directly with the public anon key, which meant the
// database had to allow anyone holding that key to read and write every table. Now the
// browser sends a small query description here (via lib/db-client.ts), this route checks
// the login, validates the request, and runs it with the server-only service role key.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLES = new Set([
  'industrial_sale_comps',
  'market_availabilities',
  'lease_comps',
  'lease_market_availabilities',
  'opv_reports',
  'pcre_sale_transactions',
  'pcre_lease_transactions',
])

const IDENT = /^[a-z_][a-z0-9_]*$/
const COLUMNS = /^(\*|[a-z_][a-z0-9_]*(\s*,\s*[a-z_][a-z0-9_]*)*)$/
const FILTER_OPS = new Set(['eq', 'ilike', 'gte', 'lte', 'in'])
const MAX_ROWS = 2000

type Filter = { op: string; col: string; val: unknown }
type Order = { col: string; ascending?: boolean; nullsFirst?: boolean }
export type DbRequest = {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  columns?: string
  count?: 'exact'
  returning?: boolean
  values?: Record<string, unknown> | Record<string, unknown>[]
  filters?: Filter[]
  order?: Order[]
  range?: [number, number]
  limit?: number
}

const bad = (message: string, status = 400) =>
  NextResponse.json({ data: null, count: null, error: { message } }, { status })

function validate(r: DbRequest): string | null {
  if (!r || typeof r !== 'object') return 'Invalid request'
  if (!TABLES.has(r.table)) return 'Unknown table'
  if (!['select', 'insert', 'update', 'delete'].includes(r.op)) return 'Unknown operation'
  if (r.columns !== undefined && !COLUMNS.test(r.columns)) return 'Invalid columns'
  for (const f of r.filters ?? []) {
    if (!FILTER_OPS.has(f.op) || !IDENT.test(f.col)) return 'Invalid filter'
    if (f.op === 'in' && !Array.isArray(f.val)) return 'Invalid filter'
  }
  for (const o of r.order ?? []) if (!IDENT.test(o.col)) return 'Invalid order'
  if (r.range) {
    const [from, to] = r.range
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to - from >= MAX_ROWS) return 'Invalid range'
  }
  if (r.limit !== undefined && (!Number.isInteger(r.limit) || r.limit < 1 || r.limit > MAX_ROWS)) return 'Invalid limit'

  if (r.op === 'insert') {
    const rows = Array.isArray(r.values) ? r.values : [r.values]
    if (!rows.length || rows.length > MAX_ROWS || rows.some(v => !v || typeof v !== 'object' || Array.isArray(v))) return 'Invalid rows'
  }
  if (r.op === 'update' && (!r.values || typeof r.values !== 'object' || Array.isArray(r.values))) return 'Invalid values'
  // Updates and deletes must target exactly one record by id — no bulk changes through this route.
  if (r.op === 'update' || r.op === 'delete') {
    const f = r.filters ?? []
    if (f.length !== 1 || f[0].op !== 'eq' || f[0].col !== 'id' || f[0].val == null || f[0].val === '') {
      return 'Updates and deletes must target a single record by id'
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!hasSession(req)) return bad('Not signed in', 401)

  let r: DbRequest
  try { r = await req.json() } catch { return bad('Invalid JSON') }
  const problem = validate(r)
  if (problem) return bad(problem)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any
  const table = supabase.from(r.table)
  if (r.op === 'select') q = table.select(r.columns ?? '*', r.count ? { count: r.count } : undefined)
  else if (r.op === 'insert') q = table.insert(Array.isArray(r.values) ? r.values : [r.values!])
  else if (r.op === 'update') q = table.update(r.values as Record<string, unknown>)
  else q = table.delete()

  for (const f of r.filters ?? []) q = q[f.op](f.col, f.val)
  for (const o of r.order ?? []) q = q.order(o.col, { ascending: o.ascending ?? true, nullsFirst: o.nullsFirst })
  if (r.range) q = q.range(r.range[0], r.range[1])
  if (r.limit) q = q.limit(r.limit)
  if (r.op !== 'select' && r.returning) q = q.select(r.columns ?? '*')

  const { data, error, count } = await q
  return NextResponse.json({
    data: data ?? null,
    count: count ?? null,
    error: error ? { message: error.message } : null,
  })
}
