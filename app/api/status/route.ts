export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Ensure status columns exist on both tables
async function ensureStatusColumns() {
  try {
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.industrial_sale_comps ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Closed';
        ALTER TABLE public.market_availabilities ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available';
        UPDATE public.market_availabilities SET status = 'Available' WHERE status IS NULL;
        UPDATE public.industrial_sale_comps SET status = 'Closed' WHERE status IS NULL;
      `
    })
  } catch {}
}

// GET — trigger migration (call once to add columns)
export async function GET() {
  await ensureStatusColumns()
  return NextResponse.json({ ok: true })
}

// PATCH — update status on a single record
// Query params: table=comps|avails, id=<uuid>
// Body: { status: string }
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table')
  const id = searchParams.get('id')
  if (!table || !id) return NextResponse.json({ error: 'table and id required' }, { status: 400 })

  const tableName = table === 'comps' ? 'industrial_sale_comps' : 'market_availabilities'
  const { status } = await req.json()
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  await ensureStatusColumns()
  const { error } = await supabase.from(tableName).update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
