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
        saved_by text,
        address text,
        subject_json text,
        comps_json text,
        avails_json text,
        analytics_json text,
        ai_text text
      );
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
    .select('id, created_at, saved_by, address')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data })
}

// POST — save an OPV
export async function POST(req: NextRequest) {
  await ensureTable()
  const { savedBy, address, subject, comps, avails, analytics, aiText } = await req.json()
  const { data, error } = await supabaseAdmin.from(TABLE).insert({
    saved_by: savedBy || 'Unknown',
    address: address || 'Unknown',
    subject_json: JSON.stringify(subject),
    comps_json: JSON.stringify(comps),
    avails_json: JSON.stringify(avails),
    analytics_json: JSON.stringify(analytics),
    ai_text: aiText || '',
  }).select().single()
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
    avails: JSON.parse(data.avails_json || '[]'),
    analytics: JSON.parse(data.analytics_json || 'null'),
    aiText: data.ai_text || '',
    address: data.address,
    savedBy: data.saved_by,
    createdAt: data.created_at,
  })
}
