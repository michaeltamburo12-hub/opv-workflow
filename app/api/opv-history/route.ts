export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLE = 'opv_reports'

const parse = (s: string | null | undefined, fallback: unknown) => {
  try { return s ? JSON.parse(s) : fallback } catch { return fallback }
}

// Shape returned to the client for a full OPV (used by PATCH and by POST on conflict)
const toClient = (data: Record<string, any>) => ({
  id:                 data.id,
  subject:            parse(data.subject_json, null),
  comps:              parse(data.comps_json, []),
  leaseComps:         parse(data.lease_comps_json, []),
  leaseAvails:        parse(data.lease_avails_json, []),
  avails:             parse(data.avails_json, []),
  analytics:          parse(data.analytics_json, null),
  aiText:             data.ai_text || '',
  folders:            parse(data.folders_json, []),
  assignmentData:     parse(data.assignment_json, {}),
  photoUrls:          parse(data.photo_urls_json, {}),
  photoOverrides:     parse(data.photo_overrides_json, {}),
  textEdits:          parse(data.text_edits_json, {}),
  verificationStatus: parse(data.verification_json, {}),
  address:            data.address,
  savedBy:            data.saved_by,
  createdAt:          data.created_at,
  updatedAt:          data.updated_at,
  currentStep:        data.current_step || '',
  editedReportHTML:   data.edited_report_html || null,
  editedReportSig:    data.edited_report_sig || null,
})

// GET — list saved OPVs, or ?id=…&meta=1 for just one OPV's updated_at (cheap sync poll)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const { data, error } = await supabaseAdmin.from(TABLE).select('id, updated_at').eq('id', id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id, updated_at: data?.updated_at ?? null })
  }
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('id, created_at, updated_at, saved_by, address, current_step')
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data })
}

// POST — save a new OPV, or update an existing one.
// For updates the client sends baseUpdatedAt (the updated_at it last loaded/saved). If the row has
// changed since then, nothing is written and 409 is returned with the current row so the client
// can merge instead of overwriting a teammate's save.
export async function POST(req: NextRequest) {
  const {
    savedBy, address, subject, comps, leaseComps, leaseAvails, avails,
    analytics, aiText, currentStep, existingId, baseUpdatedAt, folders, assignmentData,
    editedReportHTML, editedReportSig, photoUrls, photoOverrides, textEdits, verificationStatus,
  } = await req.json()

  const payload = {
    saved_by:             savedBy || 'Unknown',
    address:              address || 'Unknown',
    current_step:         currentStep || '',
    updated_at:           new Date().toISOString(),
    subject_json:         JSON.stringify(subject),
    comps_json:           JSON.stringify(comps || []),
    lease_comps_json:     JSON.stringify(leaseComps || []),
    lease_avails_json:    JSON.stringify(leaseAvails || []),
    avails_json:          JSON.stringify(avails || []),
    analytics_json:       JSON.stringify(analytics || null),
    ai_text:              aiText || '',
    folders_json:         JSON.stringify(folders || []),
    assignment_json:      JSON.stringify(assignmentData || {}),
    photo_urls_json:      JSON.stringify(photoUrls || {}),
    photo_overrides_json: JSON.stringify(photoOverrides || {}),
    text_edits_json:      JSON.stringify(textEdits || {}),
    verification_json:    JSON.stringify(verificationStatus || {}),
    edited_report_html:   editedReportHTML || null,
    edited_report_sig:    editedReportSig || null,
  }

  if (existingId) {
    let query = supabaseAdmin.from(TABLE).update(payload).eq('id', existingId)
    if (baseUpdatedAt) query = query.eq('updated_at', baseUpdatedAt)
    const { data, error } = await query.select('updated_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) {
      const { data: current, error: readErr } = await supabaseAdmin.from(TABLE).select('*').eq('id', existingId).maybeSingle()
      if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
      if (!current) return NextResponse.json({ error: 'This OPV no longer exists (it may have been deleted).', missing: true }, { status: 404 })
      return NextResponse.json({ conflict: true, current: toClient(current) }, { status: 409 })
    }
    return NextResponse.json({ id: existingId, updated_at: data[0].updated_at })
  }

  const { data, error } = await supabaseAdmin.from(TABLE).insert(payload).select('id, updated_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id, updated_at: data?.updated_at })
}

// DELETE — remove a saved OPV
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from(TABLE).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — load a full OPV
export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from(TABLE).select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(toClient(data))
}
