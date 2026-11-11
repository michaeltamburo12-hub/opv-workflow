// Browser-side stand-in for the Supabase client. It supports the subset of the query-builder
// API the app uses (select/insert/update/delete, eq/ilike/gte/lte/in, order/range/limit) and
// sends each query to /api/db, which checks the login and runs it server-side. The browser never
// talks to Supabase directly, so the database can stay closed to the public anon key.
//
// Usage is the same as supabase-js:  const { data, error, count } = await db.from('t').select('*').eq('id', x)

import type { DbRequest } from '@/app/api/db/route'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbResult = { data: any; error: { message: string } | null; count: number | null }

type Filter = NonNullable<DbRequest['filters']>[number]

async function run(spec: DbRequest): Promise<DbResult> {
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    })
    // A signed-out request gets redirected to the login page (HTML), not JSON.
    if (!res.headers.get('content-type')?.includes('application/json')) {
      return { data: null, count: null, error: { message: 'Your session has expired. Please sign in again.' } }
    }
    return (await res.json()) as DbResult
  } catch (e) {
    return { data: null, count: null, error: { message: e instanceof Error ? e.message : 'Network error' } }
  }
}

class Query implements PromiseLike<DbResult> {
  constructor(private spec: DbRequest) {}

  private next(patch: Partial<DbRequest>) {
    return new Query({ ...this.spec, ...patch })
  }
  private filter(op: Filter['op'], col: string, val: unknown) {
    return this.next({ filters: [...(this.spec.filters ?? []), { op, col, val }] })
  }

  // select() starts a read; after insert/update it asks for the written rows back (like supabase-js).
  select(columns = '*', opts?: { count?: 'exact' }) {
    if (this.spec.op === 'select') return this.next({ columns, count: opts?.count })
    return this.next({ returning: true, columns })
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    return this.next({ op: 'insert', values })
  }
  update(values: Record<string, unknown>) {
    return this.next({ op: 'update', values })
  }
  delete() {
    return this.next({ op: 'delete' })
  }

  eq(col: string, val: unknown) { return this.filter('eq', col, val) }
  ilike(col: string, pattern: string) { return this.filter('ilike', col, pattern) }
  gte(col: string, val: unknown) { return this.filter('gte', col, val) }
  lte(col: string, val: unknown) { return this.filter('lte', col, val) }
  in(col: string, vals: unknown[]) { return this.filter('in', col, vals) }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    return this.next({ order: [...(this.spec.order ?? []), { col, ...opts }] })
  }
  range(from: number, to: number) { return this.next({ range: [from, to] }) }
  limit(n: number) { return this.next({ limit: n }) }

  then<T1 = DbResult, T2 = never>(
    onfulfilled?: ((value: DbResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return run(this.spec).then(onfulfilled, onrejected)
  }
}

export const db = {
  from: (table: string) => new Query({ table, op: 'select' }),
}
