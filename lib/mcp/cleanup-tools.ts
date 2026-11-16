import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { supabaseAdmin as sb } from '@/lib/supabase-server'
import { DatasetName, Row, ds, fillPricePerSf, normalizeAddress } from './datasets'
import { ok, fail, datasetArg, uuid, safe, fetchAll, logWrite, blank } from './util'

// Record clean-up: find duplicates, merge the details of two records, and permanently delete.
// Each tool tells Claude to get the user's OK first; the tools themselves do exactly one step.

const same = (a: unknown, b: unknown) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()

// Field-by-field comparison of two records: values that differ, and values only one of them has.
function compare(name: DatasetName, a: Row, b: Row) {
  const differ: Record<string, [unknown, unknown]> = {}
  const onlyFirst: Record<string, unknown> = {}
  const onlySecond: Record<string, unknown> = {}
  for (const k of Object.keys(ds(name).columns)) {
    const x = a[k], y = b[k]
    if (blank(x) && blank(y)) continue
    if (blank(y)) onlyFirst[k] = x
    else if (blank(x)) onlySecond[k] = y
    else if (!same(x, y) && Number(x) !== Number(y)) differ[k] = [x, y]
  }
  return { differ, only_in_first: onlyFirst, only_in_second: onlySecond }
}

export function registerCleanupTools(server: McpServer, user: { sub: string }) {
  server.registerTool('find_duplicates', {
    title: 'Find duplicate records',
    description: 'Finds likely duplicate records in one dataset (same street address; for comps also the same or a missing date). Returns each group with every record side by side and a field-by-field comparison of the first two. Show the user each group and ask which record to keep before merging or deleting anything.',
    inputSchema: {
      dataset: datasetArg,
      town: z.string().optional().describe('Only check this town / city'),
      address: z.string().optional().describe('Only check addresses containing this'),
      include_different_dates: z.boolean().optional().describe('Also list comps at the same address with different dates (usually separate sales, not duplicates). Default false'),
    },
    annotations: { readOnlyHint: true },
  }, async (a) => {
    const d = ds(a.dataset)
    let rows: Row[]
    try {
      rows = await fetchAll(d.table, '*', q => {
        if (a.town) q = q.ilike(d.town, `%${safe(a.town)}%`)
        if (a.address) q = q.ilike('address', `%${safe(a.address)}%`)
        return q
      })
    } catch (e) { return fail((e as Error).message) }

    const byAddr = new Map<string, Row[]>()
    for (const r of rows) {
      const k = normalizeAddress(r.address)
      if (k) byAddr.set(k, [...(byAddr.get(k) ?? []), r])
    }
    const groups: unknown[] = []
    for (const [, rs] of byAddr) {
      if (rs.length < 2) continue
      let members = rs
      if (d.date && !a.include_different_dates) {
        // Keep records that share a date with another record, or have no date
        members = rs.filter(r => blank(r[d.date!]) || rs.some(o => o !== r && (blank(o[d.date!]) || o[d.date!] === r[d.date!])))
        if (members.length < 2) continue
      }
      groups.push({
        address: members[0].address,
        records: members,
        comparison_of_first_two: compare(a.dataset, members[0], members[1]),
      })
      if (groups.length >= 40) break
    }
    return ok({ dataset: a.dataset, checked: rows.length, duplicate_groups: groups.length, groups, note: groups.length >= 40 ? 'Showing the first 40 groups; narrow by town to see more.' : undefined })
  })

  server.registerTool('merge_records', {
    title: 'Merge duplicate details',
    description: 'Copies details from one record into the record being kept. By default only fills fields that are empty on the kept record; list fields in overwrite to replace values the kept record already has. Does not delete anything (use delete_records afterwards). Before calling, show the user exactly which fields will be copied and get their OK.',
    inputSchema: {
      dataset: datasetArg,
      keep_id: uuid.describe('The record to keep'),
      from_id: uuid.describe('The duplicate to copy details from'),
      overwrite: z.array(z.string()).optional().describe('Fields to take from the duplicate even though the kept record has a value'),
      skip: z.array(z.string()).optional().describe('Fields not to copy'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  }, async (a) => {
    if (a.keep_id === a.from_id) return fail('keep_id and from_id are the same record')
    const d = ds(a.dataset)
    const { data, error } = await sb.from(d.table).select('*').in('id', [a.keep_id, a.from_id])
    if (error) return fail(error.message)
    const keep = data?.find(r => r.id === a.keep_id) as Row | undefined
    const from = data?.find(r => r.id === a.from_id) as Row | undefined
    if (!keep || !from) return fail(`Record not found: ${!keep ? a.keep_id : a.from_id}`)

    const overwrite = new Set(a.overwrite ?? []), skip = new Set(a.skip ?? [])
    const unknown = [...overwrite, ...skip].filter(k => !(k in d.columns))
    const values: Row = {}
    for (const k of Object.keys(d.columns)) {
      if (skip.has(k) || blank(from[k])) continue
      if (blank(keep[k]) || (overwrite.has(k) && !same(keep[k], from[k]))) values[k] = from[k]
    }
    if (!Object.keys(values).length) return ok({ dataset: a.dataset, keep_id: a.keep_id, changed: {}, note: 'Nothing to copy: the kept record already has every detail the duplicate has.', unknown_fields: unknown })
    fillPricePerSf(d, values, keep)

    const { data: after, error: e2 } = await sb.from(d.table).update(values).eq('id', a.keep_id).select('*').single()
    if (e2) return fail(e2.message)
    logWrite(user.sub, 'merge', a.dataset, [a.keep_id, a.from_id])
    const changed: Record<string, { before: unknown; after: unknown }> = {}
    for (const k of Object.keys(values)) changed[k] = { before: keep[k], after: (after as Row)[k] }
    return ok({ dataset: a.dataset, keep_id: a.keep_id, address: keep.address, changed, unknown_fields: unknown.length ? unknown : undefined, next: `If the user agreed, delete the duplicate with delete_records (id ${a.from_id}).` })
  })

  server.registerTool('delete_records', {
    title: 'Delete records permanently',
    description: 'PERMANENTLY deletes records (up to 25) by id; this cannot be undone. Use for duplicates (after merging any missing details) and for listings taken off the market. Before calling, list each record (address, size, price, date) for the user and get an explicit OK. Saved OPVs keep their own copy of any comp they used, so deleting a record does not change existing OPVs. Returns the full deleted records so they could be re-added if needed.',
    inputSchema: {
      dataset: datasetArg,
      ids: z.array(uuid).min(1).max(25),
      reason: z.string().optional().describe('Why, e.g. "duplicate of <id>" or "off market"; recorded in the server log'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  }, async (a) => {
    const d = ds(a.dataset)
    const ids = Array.from(new Set(a.ids))
    const { data: rows, error } = await sb.from(d.table).select('*').in('id', ids)
    if (error) return fail(error.message)
    const found = (rows ?? []) as Row[]
    const missing = ids.filter(id => !found.some(r => r.id === id))
    if (!found.length) return fail('None of those records exist (already deleted?): ' + missing.join(', '))
    const { error: e2 } = await sb.from(d.table).delete().in('id', found.map(r => r.id as string))
    if (e2) return fail(e2.message)
    logWrite(user.sub, 'delete' + (a.reason ? `: ${a.reason}` : ''), a.dataset, found.map(r => String(r.id)))
    return ok({ dataset: a.dataset, deleted: found.length, not_found: missing.length ? missing : undefined, deleted_records: found })
  })
}
