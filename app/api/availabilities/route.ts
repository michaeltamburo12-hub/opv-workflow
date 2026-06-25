import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  
  let query = supabase.from('industrial_availabilities').select('*')

  if (searchParams.get('county')) query = query.eq('county', searchParams.get('county')!)
  if (searchParams.get('city')) query = query.ilike('city', `%${searchParams.get('city')}%`)
  if (searchParams.get('address')) query = query.ilike('address', `%${searchParams.get('address')}%`)
  if (searchParams.get('zoning')) query = query.ilike('zoning', `%${searchParams.get('zoning')}%`)
  if (searchParams.get('min_sf')) query = query.gte('building_sf', Number(searchParams.get('min_sf')))
  if (searchParams.get('max_sf')) query = query.lte('building_sf', Number(searchParams.get('max_sf')))
  if (searchParams.get('min_price')) query = query.gte('asking_price', Number(searchParams.get('min_price')))
  if (searchParams.get('max_price')) query = query.lte('asking_price', Number(searchParams.get('max_price')))
  if (searchParams.get('status')) query = query.eq('status', searchParams.get('status')!)
  else query = query.eq('status', 'Available')

  query = query.order('created_at', { ascending: false }).limit(200)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabase.from('industrial_availabilities').insert([body]).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
