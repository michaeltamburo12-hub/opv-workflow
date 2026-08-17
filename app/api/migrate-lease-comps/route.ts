import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MIGRATION_SQL = `
ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS escalations text;
`.trim()

export async function POST() {
  const { error } = await supabaseAdmin.rpc('exec_sql', { sql: MIGRATION_SQL })
  if (error) {
    return NextResponse.json({ status: 'error', message: error.message, sql: MIGRATION_SQL }, { status: 500 })
  }
  return NextResponse.json({ status: 'ok', message: 'escalations column added to lease_comps' })
}
