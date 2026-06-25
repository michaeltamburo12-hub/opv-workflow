import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type SaleComp = {
  id: string
  address: string
  city: string
  state: string
  property_type: string
  building_sf: number | null
  lot_size_ac: number | null
  num_floors: number | null
  ceiling_height: string | null
  column_spacing: string | null
  loading_docks: string | null
  drive_ins: string | null
  power: string | null
  heat: string | null
  parking: string | null
  sprinkler: string | null
  sewer: string | null
  zoning: string | null
  real_estate_taxes: number | null
  sale_price: number | null
  price_per_sf: number | null
  sale_date: string | null
  sale_status: string | null
  asking_price: number | null
  sale_type: string | null
  buyer: string | null
  seller: string | null
  listing_broker: string | null
  market: string | null
  submarket: string | null
  zip_code: string | null
  county: string | null
  notes: string | null
}

export type Availability = {
  id: string
  address: string
  city: string
  state: string
  property_type: string
  building_sf: number | null
  lot_size_ac: number | null
  num_floors: number | null
  ceiling_height: string | null
  column_spacing: string | null
  loading_docks: string | null
  drive_ins: string | null
  power: string | null
  heat: string | null
  parking: string | null
  sprinkler: string | null
  sewer: string | null
  zoning: string | null
  real_estate_taxes: number | null
  asking_price: number | null
  price_per_sf: number | null
  pricing_guidance: string | null
  availability_type: string | null
  status: string | null
  listing_broker: string | null
  market: string | null
  submarket: string | null
  zip_code: string | null
  county: string | null
  loopnet_url: string | null
  notes: string | null
}
