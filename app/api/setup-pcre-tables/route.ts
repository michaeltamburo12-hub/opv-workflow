import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CREATE_SALES_SQL = `
CREATE TABLE IF NOT EXISTS public.pcre_sale_transactions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  address          text,
  city             text,
  county           text,
  property_type    text,
  building_sf      numeric,
  sale_price_text  text,
  sale_date        date,
  buyer            text,
  seller           text,
  notes            text,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.pcre_sale_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pcre_sale_transactions' AND policyname='Allow all pcre_sales') THEN
    CREATE POLICY "Allow all pcre_sales" ON public.pcre_sale_transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`.trim()

const CREATE_LEASES_SQL = `
CREATE TABLE IF NOT EXISTS public.pcre_lease_transactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  address     text,
  city        text,
  county      text,
  tenant      text,
  landlord    text,
  building_sf numeric,
  lease_price text,
  lease_date  date,
  lease_term  text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.pcre_lease_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pcre_lease_transactions' AND policyname='Allow all pcre_leases') THEN
    CREATE POLICY "Allow all pcre_leases" ON public.pcre_lease_transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`.trim()

async function ensureTable(
  tableName: string,
  createSQL: string,
): Promise<{ status: string; sql?: string }> {
  // Check if table exists
  const { error: checkErr } = await supabaseAdmin
    .from(tableName)
    .select('id', { count: 'exact', head: true })

  const tableExists = !checkErr || !checkErr.message.includes('relation')

  if (tableExists) return { status: 'exists' }

  // Try to create via exec_sql RPC
  const { error: rpcErr } = await supabaseAdmin.rpc('exec_sql', { sql: createSQL })
  if (rpcErr) {
    return { status: 'needs_manual_creation', sql: createSQL }
  }

  return { status: 'created' }
}

export async function POST() {
  const [salesResult, leasesResult] = await Promise.all([
    ensureTable('pcre_sale_transactions', CREATE_SALES_SQL),
    ensureTable('pcre_lease_transactions', CREATE_LEASES_SQL),
  ])

  return NextResponse.json({
    sales: salesResult.status,
    leases: leasesResult.status,
    // Only present when manual creation is required
    ...(salesResult.sql ? { sales_sql: salesResult.sql } : {}),
    ...(leasesResult.sql ? { leases_sql: leasesResult.sql } : {}),
  })
}
