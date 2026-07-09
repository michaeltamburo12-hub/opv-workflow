import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SEED_SALES = [
  { address: '128 Spagnoli Rd', city: 'Melville', county: 'Suffolk', property_type: 'Redevelopment', building_sf: 150000, sale_price_text: '$21,000,000', sale_date: '2025-09-01' },
  { address: '48 Mall Dr', city: 'Commack', county: 'Suffolk', property_type: 'Industrial', building_sf: 20000, sale_price_text: '$4,700,000', sale_date: '2025-05-01' },
  { address: '22 Sutton Place', city: 'Brewster', county: 'Suffolk', property_type: 'Industrial', building_sf: 70000, sale_price_text: 'Undisclosed', sale_date: '2025-02-01' },
  { address: '474 Grand Blvd', city: 'Westbury', county: 'Nassau', property_type: 'Industrial', building_sf: 71000, sale_price_text: '$14,250,000', sale_date: '2024-11-01' },
  { address: '145 Kennedy Dr', city: 'Hauppauge', county: 'Suffolk', property_type: 'Industrial', building_sf: 40000, sale_price_text: '$8,150,000', sale_date: '2024-08-01' },
  { address: '200 Central Ave', city: 'Farmingdale', county: 'Nassau', property_type: 'Industrial', building_sf: 25000, sale_price_text: '$5,875,000', sale_date: '2024-05-01' },
  { address: '218 Front St', city: 'Hempstead', county: 'Nassau', property_type: 'Industrial', building_sf: 30183, sale_price_text: '$4,750,000', sale_date: '2024-02-01' },
  { address: '30 Eastern Ave', city: 'Deer Park', county: 'Suffolk', property_type: 'Industrial', building_sf: 11940, sale_price_text: '$2,200,000', sale_date: '2024-02-01' },
  { address: '81 Modular Ave', city: 'Commack', county: 'Suffolk', property_type: 'Industrial', building_sf: 30000, sale_price_text: '$6,150,000', sale_date: '2023-11-01' },
]

const SEED_LEASES = [
  { address: '1460 N Clinton Ave', city: 'Bay Shore', county: 'Suffolk', tenant: 'Absolute Home Contracting', building_sf: 2000, lease_price: '$20.00 PSF', lease_date: '2025-08-01' },
  { address: '99 Seaview Blvd', city: 'Port Washington', county: 'Nassau', tenant: 'Pyramid Flooring', building_sf: 9000, lease_price: '$18.00 PSF', lease_date: '2025-05-01' },
  { address: '80 13th Ave', city: 'Ronkonkoma', county: 'Suffolk', tenant: 'Demil Corp', building_sf: 7500, lease_price: '$15.00 PSF', lease_date: '2025-05-01' },
  { address: '170 Express St', city: 'Plainview', county: 'Nassau', tenant: 'Life Plus Style Gourmet', building_sf: 42000, lease_price: '$12.00 Gross', lease_date: '2025-05-01' },
  { address: '40 Rabro Dr', city: 'Hauppauge', county: 'Suffolk', tenant: 'Blue Point Dance', building_sf: 6900, lease_price: '$17.40 Gross', lease_date: '2025-08-01' },
  { address: '260 Spagnoli Rd', city: 'Melville', county: 'Suffolk', tenant: 'LIBM Inc.', building_sf: 54000, lease_price: '$17.00 Gross', lease_date: '2025-05-01' },
  { address: '47 Mall Dr', city: 'Commack', county: 'Suffolk', tenant: 'eBizware', building_sf: 10000, lease_price: '$17.50 Gross', lease_date: '2025-05-01' },
  { address: '1980 New Highway', city: 'Farmingdale', county: 'Nassau', tenant: 'Top Bright Inc.', building_sf: 26500, lease_price: '$16.00 Gross', lease_date: '2025-02-01' },
]

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
  seedData: Record<string, unknown>[]
): Promise<{ status: string; sql?: string }> {
  // Step 1: Check if table exists by querying it
  const { error: checkErr } = await supabaseAdmin
    .from(tableName)
    .select('id', { count: 'exact', head: true })

  const tableExists = !checkErr || !checkErr.message.includes('relation')

  if (!tableExists) {
    // Try to create via exec_sql RPC
    const { error: rpcErr } = await supabaseAdmin.rpc('exec_sql', { sql: createSQL })
    if (rpcErr) {
      // exec_sql doesn't exist or failed — return SQL for manual creation
      return { status: 'needs_manual_creation', sql: createSQL }
    }
  }

  // Table exists (or was just created) — seed if empty
  const { count } = await supabaseAdmin
    .from(tableName)
    .select('*', { count: 'exact', head: true })

  if (!count || count === 0) {
    const { error: seedErr } = await supabaseAdmin.from(tableName).insert(seedData)
    if (seedErr) return { status: 'table_exists_seed_failed' }
    return { status: 'created_and_seeded' }
  }

  return { status: 'exists', count } as { status: string; sql?: string }
}

export async function POST() {
  const [salesResult, leasesResult] = await Promise.all([
    ensureTable('pcre_sale_transactions', CREATE_SALES_SQL, SEED_SALES),
    ensureTable('pcre_lease_transactions', CREATE_LEASES_SQL, SEED_LEASES),
  ])

  return NextResponse.json({
    sales: salesResult.status,
    leases: leasesResult.status,
    // Only present when manual creation is required
    ...(salesResult.sql ? { sales_sql: salesResult.sql } : {}),
    ...(leasesResult.sql ? { leases_sql: leasesResult.sql } : {}),
  })
}
