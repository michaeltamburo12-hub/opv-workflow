export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const results: string[] = []

  const statements = [
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS heat text`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS sewer text`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS zoning text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS heat text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS sewer text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS zoning text`,
  ]

  for (const sql of statements) {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql })
    if (error) {
      results.push(`❌ ${sql} → ${error.message}`)
    } else {
      results.push(`✅ ${sql}`)
    }
  }

  return NextResponse.json({ results })
}
