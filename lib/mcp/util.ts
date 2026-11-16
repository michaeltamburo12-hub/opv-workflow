import { z } from 'zod'
import { supabaseAdmin as sb } from '@/lib/supabase-server'
import { DATASETS, DATASET_NAMES, Row } from './datasets'

export type Json = Record<string, unknown> | unknown[]
export const ok = (data: Json) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 1) }] })
export const fail = (message: string) => ({ isError: true, content: [{ type: 'text' as const, text: message }] })

export const datasetArg = z.enum(DATASET_NAMES).describe(
  'Which records: ' + DATASET_NAMES.map(n => `${n} = ${DATASETS[n].label}`).join('; '),
)
export const uuid = z.string().uuid()

// Strip characters that have meaning in PostgREST filter syntax.
export const safe = (s: string) => s.replace(/[,()*%\\]/g, ' ').trim()

const PAGE = 1000
const MAX_SCAN = 20000

// Reads every matching row (in pages) — used for stats and duplicate checks. Tables are small.
export async function fetchAll(table: string, columns: string, apply: (q: any) => any = q => q): Promise<Row[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: Row[] = []
  for (let from = 0; from < MAX_SCAN; from += PAGE) {
    const { data, error } = await apply(sb.from(table).select(columns)).order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data as Row[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

export function logWrite(sub: string, action: string, dataset: string, ids: string[]) {
  console.log(JSON.stringify({ event: 'mcp_write', via: 'claude-connector', user: sub, action, dataset, ids }))
}

export const blank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
