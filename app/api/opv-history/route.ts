export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLE = 'opv_reports'

// GET — list saved OPVs
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('id, created_at, updated_at, saved_by, address, current_step')
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data })
}

// POST — save a new OPV
export async function POST(req: NextRequest) {
  const {
    savedBy, address, subject, comps, leaseComps, leaseAvails, avails,
    analytics, aiText, currentStep, existingId, folders, assignmentData,
    editedReportHTML, photoUrls, verificationStatus,
  } = await req.json()

  const payload = {
    saved_by:           savedBy || 'Unknown',
    address:            address || 'Unknown',
    current_step:       currentStep || '',
    updated_at:         new Date().toISOString(),
    subject_json:       JSON.stringify(subject),
    comps_json:         JSON.stringify(comps || []),
    lease_comps_json:   JSON.stringify(leaseComps || []),
    lease_avails_json:  JSON.stringify(leaseAvails || []),
    avails_json:        JSON.stringify(avails || []),
    analytics_json:     JSON.stringify(analytics || null),
    ai_text:            aiText || '',
    folders_json:       JSON.stringify(folders || []),
    assignment_json:    JSON.stringify(assignmentData || {}),
    photo_urls_json:    JSON.stringify(photoUrls || {}),
    verification_json:  JSON.stringify(verificationStatus || {}),
    edited_report_html: editedReportHTML || null,
  }

  if (existingId) {
    const { error } = await supabaseAdmin.from(TABLE).update(payload).eq('id', existingId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { data: saved } = await supabaseAdmin.from(TABLE).select('updated_at').eq('id', existingId).single()
    return NextResponse.json({ id: existingId, updated_at: saved?.updated_at })
  }

  const { data, error } = await supabaseAdmin.from(TABLE).insert(payload).select().single()
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
  return NextResponse.json({
    subject:            JSON.parse(data.subject_json    || 'null'),
    comps:              JSON.parse(data.comps_json      || '[]'),
    leaseComps:         JSON.parse(data.lease_comps_json  || '[]'),
    leaseAvails:        JSON.parse(data.lease_avails_json || '[]'),
    avails:             JSON.parse(data.avails_json     || '[]'),
    analytics:          JSON.parse(data.analytics_json  || 'null'),
    aiText:             data.ai_text || '',
    folders:            JSON.parse(data.folders_json    || '[]'),
    assignmentData:     JSON.parse(data.assignment_json || '{}'),
    photoUrls:          JSON.parse(data.photo_urls_json || '{}'),
    verificationStatus: JSON.parse(data.verification_json || '{}'),
    address:            data.address,
    savedBy:            data.saved_by,
    createdAt:          data.created_at,
    updatedAt:          data.updated_at,
    currentStep:        data.current_step || '',
    editedReportHTML:   data.edited_report_html || null,
  })
}
