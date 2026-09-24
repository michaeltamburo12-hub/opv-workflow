export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Execute raw SQL via Supabase pg-meta API (uses service role key, works on Supabase Cloud)
async function runSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/pg-meta/v1/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'x-connection-encrypted': 'SUPABASE_ENCRYPTED_URL',
      },
      body: JSON.stringify({ query: sql }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      // Also try exec_sql RPC as fallback
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(SUPABASE_URL, SERVICE_KEY)
      const { error: rpcErr } = await sb.rpc('exec_sql', { sql })
      if (rpcErr) return { ok: false, error: body?.message || body?.error || `HTTP ${res.status}: ${JSON.stringify(body)}` }
      return { ok: true }
    }
    if (body?.error) return { ok: false, error: body.error }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function GET() {
  const results: { sql: string; status: string }[] = []

  const statements = [
    // ── lease_comps ──────────────────────────────────────────────────────
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS heat text`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS sewer text`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS zoning text`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS property_type text`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS re_taxes numeric`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS office_sf numeric`,
    // ── lease_market_availabilities ──────────────────────────────────────
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS heat text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS sewer text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS zoning text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS property_type text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS re_taxes numeric`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS office_sf numeric`,
    // ── opv_reports (ensure it exists with all columns) ──────────────────
    `CREATE TABLE IF NOT EXISTS public.opv_reports (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      saved_by text,
      address text,
      current_step text,
      subject_json text,
      comps_json text,
      lease_comps_json text,
      lease_avails_json text,
      avails_json text,
      analytics_json text,
      ai_text text,
      folders_json text,
      assignment_json text,
      photo_urls_json text,
      verification_json text,
      edited_report_html text
    )`,
    `ALTER TABLE public.opv_reports ADD COLUMN IF NOT EXISTS lease_comps_json text`,
    `ALTER TABLE public.opv_reports ADD COLUMN IF NOT EXISTS lease_avails_json text`,
    `ALTER TABLE public.opv_reports ADD COLUMN IF NOT EXISTS folders_json text`,
    `ALTER TABLE public.opv_reports ADD COLUMN IF NOT EXISTS assignment_json text`,
    `ALTER TABLE public.opv_reports ADD COLUMN IF NOT EXISTS photo_urls_json text`,
    `ALTER TABLE public.opv_reports ADD COLUMN IF NOT EXISTS verification_json text`,
    `ALTER TABLE public.opv_reports ADD COLUMN IF NOT EXISTS edited_report_html text`,
    `ALTER TABLE public.opv_reports ADD COLUMN IF NOT EXISTS current_step text`,
    `ALTER TABLE public.opv_reports ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`,
    // ── RLS: allow all users to read/write opv_reports ───────────────────
    `ALTER TABLE public.opv_reports ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_policies
         WHERE tablename='opv_reports' AND policyname='Allow all opv_reports'
       ) THEN
         CREATE POLICY "Allow all opv_reports"
           ON public.opv_reports FOR ALL
           USING (true) WITH CHECK (true);
       END IF;
     END $$`,
  ]

  for (const sql of statements) {
    const label = sql.slice(0, 80).replace(/\s+/g, ' ').trim() + (sql.length > 80 ? '…' : '')
    const { ok, error } = await runSQL(sql)
    results.push({ sql: label, status: ok ? '✅ OK' : `❌ ${error}` })
  }

  const allOk = results.every(r => r.status.startsWith('✅'))

  // If pg-meta failed on everything, return the SQL for manual execution
  const manualSQL = allOk ? null : statements.join(';\n\n') + ';'

  return NextResponse.json({ allOk, results, manualSQL })
}
