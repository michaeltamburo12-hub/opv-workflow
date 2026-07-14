export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — promote a record between tables
// Body for avail→comp: { direction: 'avail-to-comp', id, salePrice, saleDate, buyer, seller }
// Body for comp→avail: { direction: 'comp-to-avail', id }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { direction, id, salePrice, saleDate, buyer, seller } = body

  if (direction === 'avail-to-comp') {
    // Fetch the availability
    const { data: avail, error: fetchErr } = await supabase
      .from('market_availabilities')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr || !avail) return NextResponse.json({ error: 'Availability not found' }, { status: 404 })

    // Build the sale comp record
    const compPayload: Record<string, unknown> = {
      address: avail.address,
      city: avail.city,
      county: avail.county,
      state: avail.state || 'NY',
      property_type: avail.property_type,
      building_sf: avail.building_sf,
      lot_size_ac: avail.lot_size_ac,
      ceiling_height: avail.ceiling_height,
      loading_docks: avail.loading_docks,
      drive_ins: avail.drive_ins,
      power: avail.power,
      heat: avail.heat,
      parking: avail.parking,
      sprinkler: avail.sprinkler,
      sewer: avail.sewer,
      zoning: avail.zoning,
      real_estate_taxes: avail.real_estate_taxes,
      zip_code: avail.zip_code,
      listing_broker: avail.listing_broker,
      market: avail.market,
      submarket: avail.submarket,
      loopnet_url: avail.loopnet_url,
      sale_price: salePrice ? parseFloat(String(salePrice).replace(/[$,]/g, '')) || null : null,
      sale_date: saleDate || null,
      buyer: buyer || null,
      seller: seller || null,
      sale_type: "Arm's Length",
      status: 'Closed',
    }
    // Compute price_per_sf if possible
    if (compPayload.sale_price && avail.building_sf) {
      compPayload.price_per_sf = Number(compPayload.sale_price) / Number(avail.building_sf)
    }

    const { data: newComp, error: insertErr } = await supabase
      .from('industrial_sale_comps')
      .insert([compPayload])
      .select()
      .single()
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    // Mark the availability as Sold
    await supabase.from('market_availabilities').update({ status: 'Sold' }).eq('id', id)

    return NextResponse.json({ ok: true, comp: newComp })
  }

  if (direction === 'comp-to-avail') {
    // Fetch the comp
    const { data: comp, error: fetchErr } = await supabase
      .from('industrial_sale_comps')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr || !comp) return NextResponse.json({ error: 'Comp not found' }, { status: 404 })

    // Build the availability record from the comp's physical data
    const availPayload: Record<string, unknown> = {
      address: comp.address,
      city: comp.city,
      county: comp.county,
      state: comp.state || 'NY',
      property_type: comp.property_type,
      building_sf: comp.building_sf,
      lot_size_ac: comp.lot_size_ac,
      ceiling_height: comp.ceiling_height,
      loading_docks: comp.loading_docks,
      drive_ins: comp.drive_ins,
      power: comp.power,
      heat: comp.heat,
      parking: comp.parking,
      sprinkler: comp.sprinkler,
      sewer: comp.sewer,
      zoning: comp.zoning,
      real_estate_taxes: comp.real_estate_taxes,
      zip_code: comp.zip_code,
      listing_broker: comp.listing_broker,
      market: comp.market,
      submarket: comp.submarket,
      loopnet_url: comp.loopnet_url,
      status: 'Available',
      availability_type: 'For Sale',
    }

    const { data: newAvail, error: insertErr } = await supabase
      .from('market_availabilities')
      .insert([availPayload])
      .select()
      .single()
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    // Mark the comp as Back on Market
    await supabase.from('industrial_sale_comps').update({ status: 'Back on Market' }).eq('id', id)

    return NextResponse.json({ ok: true, avail: newAvail })
  }

  return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
}
