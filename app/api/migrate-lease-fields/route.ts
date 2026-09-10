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
    // lease_comps
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS heat text`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS sewer text`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS zoning text`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS property_type text`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS re_taxes numeric`,
    `ALTER TABLE public.lease_comps ADD COLUMN IF NOT EXISTS office_sf numeric`,
    // lease_market_availabilities
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS heat text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS sewer text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS zoning text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS property_type text`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS re_taxes numeric`,
    `ALTER TABLE public.lease_market_availabilities ADD COLUMN IF NOT EXISTS office_sf numeric`,
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
