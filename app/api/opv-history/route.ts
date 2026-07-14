export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLE = 'opv_reports'

async function ensureTable() {
  await supabaseAdmin.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS public.${TABLE} (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        saved_by text,
        address text,
        current_step text,
        subject_json text,
        comps_json text,
        lease_comps_json text,
        avails_json text,
        analytics_json text,
        ai_text text,
        folders_json text,
        assignment_json text,
        edited_report_html text
      );
      ALTER TABLE public.${TABLE} ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
      ALTER TABLE public.${TABLE} ADD COLUMN IF NOT EXISTS current_step text;
      ALTER TABLE public.${TABLE} ADD COLUMN IF NOT EXISTS lease_comps_json text;
      ALTER TABLE public.${TABLE} ADD COLUMN IF NOT EXISTS folders_json text;
      ALTER TABLE public.${TABLE} ADD COLUMN IF NOT EXISTS assignment_json text;
      ALTER TABLE public.${TABLE} ADD COLUMN IF NOT EXISTS edited_report_html text;
      ALTER TABLE public.${TABLE} ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='${TABLE}' AND policyname='Allow all opv_reports') THEN
          CREATE POLICY "Allow all opv_reports" ON public.${TABLE} FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `
  })
}

// GET — list saved OPVs
export async function GET() {
  await ensureTable()
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
  await ensureTable()
  const { savedBy, address, subject, comps, leaseComps, avails, analytics, aiText, currentStep, existingId, folders, assignmentData, editedReportHTML } = await req.json()

  const payload = {
    saved_by: savedBy || 'Unknown',
    address: address || 'Unknown',
    current_step: currentStep || '',
    updated_at: new Date().toISOString(),
    subject_json: JSON.stringify(subject),
    comps_json: JSON.stringify(comps),
    lease_comps_json: JSON.stringify(leaseComps || []),
    avails_json: JSON.stringify(avails),
    analytics_json: JSON.stringify(analytics),
    ai_text: aiText || '',
    folders_json: JSON.stringify(folders || []),
    assignment_json: JSON.stringify(assignmentData || {}),
    edited_report_html: editedReportHTML || null,
  }

  // If updating an existing save, upsert it
  if (existingId) {
    const { error } = await supabaseAdmin.from(TABLE).update(payload).eq('id', existingId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: existingId })
  }

  const { data, error } = await supabaseAdmin.from(TABLE).insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
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
    subject: JSON.parse(data.subject_json || 'null'),
    comps: JSON.parse(data.comps_json || '[]'),
    leaseComps: JSON.parse(data.lease_comps_json || '[]'),
    avails: JSON.parse(data.avails_json || '[]'),
    analytics: JSON.parse(data.analytics_json || 'null'),
    aiText: data.ai_text || '',
    folders: JSON.parse(data.folders_json || '[]'),
    assignmentData: JSON.parse(data.assignment_json || '{}'),
    editedReportHTML: data.edited_report_html || null,
    address: data.address,
    savedBy: data.saved_by,
    createdAt: data.created_at,
    currentStep: data.current_step || '',
  })
}
