import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  
  let query = supabase.from('industrial_sale_comps').select('*')

  if (searchParams.get('county')) query = query.eq('county', searchParams.get('county')!)
  if (searchParams.get('city')) query = query.ilike('city', `%${searchParams.get('city')}%`)
  if (searchParams.get('address')) query = query.ilike('address', `%${searchParams.get('address')}%`)
  if (searchParams.get('zoning')) query = query.ilike('zoning', `%${searchParams.get('zoning')}%`)
  if (searchParams.get('min_sf')) query = query.gte('building_sf', Number(searchParams.get('min_sf')))
  if (searchParams.get('max_sf')) query = query.lte('building_sf', Number(searchParams.get('max_sf')))
  if (searchParams.get('min_price')) query = query.gte('sale_price', Number(searchParams.get('min_price')))
  if (searchParams.get('max_price')) query = query.lte('sale_price', Number(searchParams.get('max_price')))
  if (searchParams.get('min_date')) query = query.gte('sale_date', searchParams.get('min_date')!)
  if (searchParams.get('max_date')) query = query.lte('sale_date', searchParams.get('max_date')!)
  if (searchParams.get('sewer')) query = query.eq('sewer', searchParams.get('sewer')!)
  if (searchParams.get('loading_docks')) query = query.not('loading_docks', 'is', null)

  query = query.order('sale_date', { ascending: false }).limit(200)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
