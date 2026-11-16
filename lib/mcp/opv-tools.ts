import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { supabaseAdmin as sb } from '@/lib/supabase-server'
import { computeAnalytics, OUTLIER_RULE } from '@/lib/analytics'
import { withPricePerSf } from '@/lib/format'
import { pdfLink } from '@/lib/pdf'
import { DatasetName, Row, ds } from './datasets'
import { ok, fail, uuid, logWrite } from './util'

// Building an OPV end to end from Claude: create it, pick its comps and listings, write the
// narrative and value range, then export the PDF. Everything is saved to the same opv_reports
// row the app uses, so the OPV can also be opened and edited in the app at any point.

const TABLE = 'opv_reports'

// Connector field name -> the app's subject form key
const SUBJECT_FIELDS = {
  address: ['address', 'Street address only, e.g. "45 Orville Dr" (the report adds the town from city)'],
  city: ['city', 'City / town'],
  county: ['county', 'Nassau or Suffolk'],
  municipality: ['municipality', 'e.g. "Town of Islip"'],
  parcel_id: ['parcelId', 'Section-Block-Lot'],
  property_type: ['type', 'e.g. Warehouse, Manufacturing, Flex, Distribution'],
  building_sf: ['size', 'Building size in SF (number)'],
  lot_size: ['lot', 'Lot size, e.g. "2.1" (acres)'],
  clear_height: ['ceiling', 'Clear height in feet, e.g. "22" or "14-16"'],
  year_built: ['yearBuilt', ''],
  loading_docks: ['docks', 'Number of loading docks'],
  drive_ins: ['driveIn', 'Number of drive-in doors'],
  office_pct: ['officePct', 'Office percentage (number)'],
  parking: ['parking', 'Parking spaces'],
  power: ['power', 'e.g. "400A/3ph"'],
  heat: ['heat', 'Gas FHA, Gas Unit Heaters, Electric, Oil or None'],
  sprinkler: ['sprinkler', 'Wet, Dry, ESFR or None'],
  sewer: ['sewer', 'Municipal or Septic'],
  construction: ['construction', 'Masonry/Steel, Tilt-up Concrete, Steel Frame or Masonry'],
  condition: ['condition', 'Excellent, Good, Average, Fair or Poor'],
  zoning: ['zoning', ''],
  taxes: ['taxes', 'Real estate taxes, $/yr (number)'],
  highest_best_use: ['highestBestUse', 'Highest & best use paragraph'],
  notes: ['notes', 'Broker notes / special features'],
} as const

const VALUE_FIELDS = {
  value_low_psf: ['estimatedValueLow', 'Sale / investment OPV: estimated value low, $/SF'],
  value_high_psf: ['estimatedValueHigh', 'Sale / investment OPV: estimated value high, $/SF'],
  cap_rate_low: ['capRateLow', 'Investment OPV: cap rate low, %'],
  cap_rate_high: ['capRateHigh', 'Investment OPV: cap rate high, %'],
  rent_low_psf: ['leasePsfLow', 'Lease OPV: estimated rent low, $/SF/yr'],
  rent_high_psf: ['leasePsfHigh', 'Lease OPV: estimated rent high, $/SF/yr'],
} as const

const fieldShape = (fields: Record<string, readonly [string, string]>) =>
  Object.fromEntries(Object.entries(fields).map(([k, [, desc]]) => [k, z.union([z.string(), z.number()]).optional().describe(desc || k)]))

const OPV_TYPES = ['For Sale', 'Investment Sale', 'For Lease'] as const
const subjectType = (t: string) => (t === 'For Lease' ? 'lease' : t === 'Investment Sale' ? 'investment' : 'sale')

const assignmentShape = {
  client_name: z.string().optional(),
  opv_type: z.enum(OPV_TYPES).optional(),
  due_date: z.string().optional().describe('YYYY-MM-DD'),
  prepared_by: z.string().optional().describe('Broker name(s) shown on the report'),
  notes: z.string().optional().describe('Assignment notes'),
  label: z.string().optional().describe("Internal name in the saved-OPV list, e.g. \"Version 2\"; the report still shows the address"),
}

const BLANK_SUBJECT: Record<string, string> = {
  address: '', city: '', county: '', municipality: '', parcelId: '', type: 'Warehouse', opvType: 'sale', size: '', lot: '',
  ceiling: '', docks: '', driveIn: '', power: '', heat: '', parking: '', sprinkler: '', sewer: '', zoning: '', taxes: '',
  yearBuilt: '', officePct: '', construction: '', condition: '', notes: '', highestBestUse: '', capRateLow: '',
  capRateHigh: '', leasePsfLow: '', leasePsfHigh: '', estimatedValueLow: '', estimatedValueHigh: '', preparedBy: '',
}

const parse = (s: unknown, fallback: unknown) => { try { return typeof s === 'string' && s ? JSON.parse(s) : fallback } catch { return fallback } }
const str = (v: unknown) => (v == null ? '' : String(v).trim())

function applyFields(target: Record<string, unknown>, input: Record<string, unknown>, fields: Record<string, readonly [string, string]>) {
  for (const [k, [key]] of Object.entries(fields)) if (input[k] !== undefined) target[key] = str(input[k])
}

function applyAssignment(asg: Record<string, unknown>, subject: Record<string, unknown>, a: Record<string, unknown>) {
  if (a.client_name !== undefined) asg.clientName = str(a.client_name)
  if (a.opv_type !== undefined) { asg.opvType = a.opv_type; subject.opvType = subjectType(String(a.opv_type)) }
  if (a.due_date !== undefined) asg.dueDate = str(a.due_date)
  if (a.prepared_by !== undefined) { asg.preparedBy = str(a.prepared_by); subject.preparedBy = str(a.prepared_by) }
  if (a.notes !== undefined) asg.notes = str(a.notes)
  if (a.label !== undefined) asg.opvLabel = str(a.label)
}

// What's still missing before the report is complete
function checklist(r: Row) {
  const subject = parse(r.subject_json, {}) as Record<string, string>
  const isLease = subject.opvType === 'lease'
  const comps = parse(r.comps_json, []) as unknown[], leaseComps = parse(r.lease_comps_json, []) as unknown[]
  const todo: string[] = []
  if (!subject.address) todo.push('subject address')
  if (!subject.size) todo.push('building size')
  if (isLease ? !leaseComps.length : !comps.length) todo.push(isLease ? 'lease comps' : 'sale comps')
  if (isLease ? !(subject.leasePsfLow && subject.leasePsfHigh) : !(subject.estimatedValueLow && subject.estimatedValueHigh)) todo.push('value range')
  if (str(r.ai_text).length < 50) todo.push('broker narrative')
  return todo
}

function links(origin: string, id: string) {
  return { open_in_app: `${origin}/?opv=${id}`, view_report_in_app: `${origin}/?opv=${id}&view=report` }
}

const SELECTIONS: Record<string, { dataset: DatasetName; column: string }> = {
  sale_comps: { dataset: 'sale_comps', column: 'comps_json' },
  lease_comps: { dataset: 'lease_comps', column: 'lease_comps_json' },
  sale_listings: { dataset: 'sale_listings', column: 'avails_json' },
  lease_listings: { dataset: 'lease_listings', column: 'lease_avails_json' },
}

export function registerOpvTools(server: McpServer, user: { sub: string }, origin: string) {
  server.registerTool('create_opv', {
    title: 'Create OPV',
    description: 'Starts a new saved OPV from the assignment and the subject property specs. Then search each dataset with the user\'s search parameters, show a short list of candidates for each, and once the user picks, call set_opv_records. Confirm the details with the user before calling.',
    inputSchema: {
      assignment: z.object({ ...assignmentShape, opv_type: z.enum(OPV_TYPES) }),
      subject: z.object({ ...fieldShape(SUBJECT_FIELDS), address: z.string() }),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (a) => {
    const subject: Record<string, unknown> = { ...BLANK_SUBJECT }
    const assignment: Record<string, unknown> = { clientName: '', propertyAddress: '', opvType: '', dueDate: '', preparedBy: '', notes: '' }
    applyFields(subject, a.subject, SUBJECT_FIELDS)
    applyAssignment(assignment, subject, a.assignment)
    assignment.propertyAddress = subject.address
    const now = new Date().toISOString()
    const { data, error } = await sb.from(TABLE).insert({
      saved_by: user.sub, address: subject.address, current_step: 'subject', updated_at: now,
      subject_json: JSON.stringify(subject), assignment_json: JSON.stringify(assignment),
      comps_json: '[]', lease_comps_json: '[]', avails_json: '[]', lease_avails_json: '[]',
      analytics_json: 'null', ai_text: '', folders_json: '[]', photo_urls_json: '{}', photo_overrides_json: '{}',
      text_edits_json: '{}', verification_json: '{}',
    }).select('*').single()
    if (error) return fail(error.message)
    logWrite(user.sub, 'create_opv', 'opvs', [data.id])
    return ok({ id: data.id, address: subject.address, ...links(origin, data.id), still_needed: checklist(data as Row) })
  })

  server.registerTool('update_opv', {
    title: 'Edit OPV',
    description: 'Changes a saved OPV: assignment details, subject property specs, the value range (sale: value_low_psf/value_high_psf in $/SF; investment: also cap rates; lease: rent_low_psf/rent_high_psf in $/SF/yr), and the broker narrative. Only the fields given change. Show the user the narrative and value range you plan to save and get their OK first.',
    inputSchema: {
      id: uuid,
      assignment: z.object(assignmentShape).optional(),
      subject: z.object(fieldShape(SUBJECT_FIELDS)).optional(),
      value_range: z.object(fieldShape(VALUE_FIELDS)).optional(),
      narrative: z.string().optional().describe('The broker narrative (plain text, paragraphs separated by blank lines). Replaces the existing one.'),
      clear_report_edits: z.boolean().optional().describe('Drop hand edits made directly in the app\'s report view so the report is rebuilt from the data. Only when the user agrees.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  }, async (a) => {
    const { data: r, error } = await sb.from(TABLE).select('*').eq('id', a.id).maybeSingle()
    if (error) return fail(error.message)
    if (!r) return fail(`No OPV with id ${a.id}`)
    const subject = { ...BLANK_SUBJECT, ...(parse(r.subject_json, {}) as object) } as Record<string, unknown>
    const assignment = parse(r.assignment_json, {}) as Record<string, unknown>
    if (a.subject) applyFields(subject, a.subject, SUBJECT_FIELDS)
    if (a.value_range) applyFields(subject, a.value_range, VALUE_FIELDS)
    if (a.assignment) applyAssignment(assignment, subject, a.assignment)
    if (a.subject?.address !== undefined) assignment.propertyAddress = subject.address

    const update: Row = {
      subject_json: JSON.stringify(subject), assignment_json: JSON.stringify(assignment),
      address: subject.address || r.address, updated_at: new Date().toISOString(),
    }
    if (a.narrative !== undefined) update.ai_text = a.narrative
    // Re-run the analysis when the OPV type changed (sale vs lease numbers)
    if (a.assignment?.opv_type) {
      const res = computeAnalytics({ isLease: subject.opvType === 'lease', comps: parse(r.comps_json, []), avails: parse(r.avails_json, []), leaseComps: parse(r.lease_comps_json, []) })
      update.analytics_json = JSON.stringify(typeof res === 'string' ? null : res)
    }
    if (a.clear_report_edits) { update.edited_report_html = null; update.edited_report_sig = null; update.text_edits_json = '{}' }
    const { data: after, error: e2 } = await sb.from(TABLE).update(update).eq('id', a.id).select('*').single()
    if (e2) return fail(e2.message)
    logWrite(user.sub, 'update_opv', 'opvs', [a.id])
    const hasHandEdits = !!after.edited_report_html || Object.keys(parse(after.text_edits_json, {}) as object).length > 0
    return ok({
      id: a.id, address: after.address, saved: Object.keys(update).filter(k => k !== 'updated_at'),
      still_needed: checklist(after as Row), ...links(origin, a.id),
      warning: hasHandEdits ? 'This OPV has text edited by hand in the app\'s report view. Those edits still show in the report and PDF where they apply. Ask the user before using clear_report_edits.' : undefined,
    })
  })

  server.registerTool('set_opv_records', {
    title: 'Choose OPV comps and listings',
    description: `Sets which sale comps, lease comps, sale listings and lease listings an OPV uses (by record id, in report order), then re-runs the value analysis the app uses. Each list given replaces that list; lists left out stay as they are; [] empties one. Returns the analysis: averages, the suggested value range and any outliers. ${OUTLIER_RULE} Tell the user about outliers.`,
    inputSchema: {
      id: uuid,
      sale_comps: z.array(uuid).max(30).optional(),
      lease_comps: z.array(uuid).max(30).optional(),
      sale_listings: z.array(uuid).max(30).optional(),
      lease_listings: z.array(uuid).max(30).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  }, async (a) => {
    const { data: r, error } = await sb.from(TABLE).select('*').eq('id', a.id).maybeSingle()
    if (error) return fail(error.message)
    if (!r) return fail(`No OPV with id ${a.id}`)
    const lists: Record<string, Row[]> = {
      sale_comps: parse(r.comps_json, []), lease_comps: parse(r.lease_comps_json, []),
      sale_listings: parse(r.avails_json, []), lease_listings: parse(r.lease_avails_json, []),
    }
    const update: Row = {}
    const notFound: Record<string, string[]> = {}
    for (const [key, sel] of Object.entries(SELECTIONS)) {
      const ids = (a as Record<string, unknown>)[key] as string[] | undefined
      if (!ids) continue
      const unique = Array.from(new Set(ids))
      let rows: Row[] = []
      if (unique.length) {
        const { data, error: e } = await sb.from(ds(sel.dataset).table).select('*').in('id', unique)
        if (e) return fail(e.message)
        rows = unique.map(id => (data as Row[]).find(x => x.id === id)).filter((x): x is Row => !!x).map(withPricePerSf)
        const missing = unique.filter(id => !(data as Row[]).some(x => x.id === id))
        if (missing.length) notFound[key] = missing
      }
      lists[key] = rows
      update[sel.column] = JSON.stringify(rows)
    }
    const subject = parse(r.subject_json, {}) as Record<string, string>
    const isLease = subject.opvType === 'lease'
    const analysis = computeAnalytics({ isLease, comps: lists.sale_comps, avails: lists.sale_listings, leaseComps: lists.lease_comps })
    update.analytics_json = JSON.stringify(typeof analysis === 'string' ? null : analysis)
    update.updated_at = new Date().toISOString()
    if (!r.current_step || r.current_step === 'subject' || r.current_step === 'assignment') update.current_step = 'broker-review'
    const { data: after, error: e2 } = await sb.from(TABLE).update(update).eq('id', a.id).select('*').single()
    if (e2) return fail(e2.message)
    logWrite(user.sub, 'set_opv_records', 'opvs', [a.id])

    const sf = Number(subject.size) || 0
    const r2 = (n: number | undefined) => (n == null ? null : Math.round(n * 100) / 100)
    let summary: unknown = analysis
    if (typeof analysis !== 'string') {
      summary = isLease
        ? { lease_comps_used: analysis.leaseCount, avg_deal_rent: r2(analysis.leaseMeanDeal), median_deal_rent: r2(analysis.leaseMedianDeal), avg_asking_rent: r2(analysis.leaseMeanAsk), min: r2(analysis.leaseMin), max: r2(analysis.leaseMax), suggested_asking_rent: r2(analysis.leaseSuggested), outliers_left_out: analysis.leaseOutliers }
        : {
            sale_comps_used: analysis.count, avg_psf: r2(analysis.mean), median_psf: r2(analysis.median), weighted_avg_psf: r2(analysis.weighted),
            min_psf: r2(analysis.min), max_psf: r2(analysis.max),
            value_range_psf: { conservative: r2(analysis.low), market: r2(analysis.market), optimistic: r2(analysis.high) },
            suggested_list_psf: analysis.suggested,
            ...(sf ? { value_range_total: { conservative: Math.round(analysis.low * sf), market: Math.round(analysis.market * sf), optimistic: Math.round(analysis.high * sf) } } : {}),
            avg_listing_asking_psf: r2(analysis.aMean),
            comp_outliers_left_out: analysis.compOutliers, listing_outliers_left_out: analysis.aOutliers,
          }
    }
    return ok({
      id: a.id,
      counts: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])),
      not_found: Object.keys(notFound).length ? notFound : undefined,
      analysis: summary,
      still_needed: checklist(after as Row), ...links(origin, a.id),
    })
  })

  server.registerTool('export_opv_pdf', {
    title: 'Export OPV as PDF',
    description: 'Returns a download link for the OPV report as a PDF, laid out exactly as the app prints it. The link works for 7 days without signing in, so share it only with the user. Building the PDF takes 10-30 seconds when the link is opened. Mention anything listed in still_needed.',
    inputSchema: { id: uuid },
    annotations: { readOnlyHint: true },
  }, async (a) => {
    const { data: r, error } = await sb.from(TABLE).select('id,address,subject_json,comps_json,lease_comps_json,ai_text,edited_report_html').eq('id', a.id).maybeSingle()
    if (error) return fail(error.message)
    if (!r) return fail(`No OPV with id ${a.id}`)
    const link = pdfLink(origin, a.id)
    return ok({
      id: a.id, address: r.address, pdf_download: link.url, link_expires: link.expires,
      still_needed: checklist(r as Row), ...links(origin, a.id),
      note: r.edited_report_html ? 'This report was edited by hand in the app; the PDF includes those edits.' : undefined,
    })
  })
}

