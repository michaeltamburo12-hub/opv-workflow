export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

export async function GET() {
  await ensureStatusColumns()
  return NextResponse.json({ ok: true })
}

// PATCH — update status, or move record to the correct table when status triggers a table change
// table=comps|avails|lease-comps|lease-avails, id=<uuid>
// Body: { status: string }
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table')
  const id = searchParams.get('id')
  if (!table || !id) return NextResponse.json({ error: 'table and id required' }, { status: 400 })

  const { status } = await req.json()
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  await ensureStatusColumns()

  // ── Avail → Comp when status = Sold ──────────────────────────────────────
  if (table === 'avails' && status === 'Sold') {
    const { data: src, error: fetchErr } = await supabase
      .from('market_availabilities').select('*').eq('id', id).single()
    if (fetchErr || !src) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

    const comp: Record<string, unknown> = {
      address:          src.address,
      city:             src.city,
      county:           src.county,
      state:            src.state,
      property_type:    src.property_type,
      building_sf:      src.building_sf,
      lot_size_ac:      src.lot_size_ac,
      ceiling_height:   src.ceiling_height,
      loading_docks:    src.loading_docks,
      drive_ins:        src.drive_ins,
      power:            src.power,
      heat:             src.heat,
      parking:          src.parking,
      sprinkler:        src.sprinkler,
      sewer:            src.sewer,
      zoning:           src.zoning,
      real_estate_taxes: src.real_estate_taxes,
      market:           src.market,
      submarket:        src.submarket,
      zip_code:         src.zip_code,
      listing_broker:   src.listing_broker,
      notes:            src.notes ? `[From Avail] ${src.notes}` : '[Moved from Market Availabilities — fill in sale price, date, buyer, seller]',
      status:           'Closed',
    }

    const { error: insErr } = await supabase.from('industrial_sale_comps').insert([comp])
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    await supabase.from('market_availabilities').delete().eq('id', id)
    return NextResponse.json({ ok: true, moved: true, to: 'comps' })
  }

  // ── Comp → Avail when status = Back on Market ─────────────────────────────
  if (table === 'comps' && status === 'Back on Market') {
    const { data: src, error: fetchErr } = await supabase
      .from('industrial_sale_comps').select('*').eq('id', id).single()
    if (fetchErr || !src) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

    const avail: Record<string, unknown> = {
      address:          src.address,
      city:             src.city,
      county:           src.county,
      state:            src.state,
      property_type:    src.property_type,
      building_sf:      src.building_sf,
      lot_size_ac:      src.lot_size_ac,
      ceiling_height:   src.ceiling_height,
      loading_docks:    src.loading_docks,
      drive_ins:        src.drive_ins,
      power:            src.power,
      heat:             src.heat,
      parking:          src.parking,
      sprinkler:        src.sprinkler,
      sewer:            src.sewer,
      zoning:           src.zoning,
      real_estate_taxes: src.real_estate_taxes,
      market:           src.market,
      submarket:        src.submarket,
      zip_code:         src.zip_code,
      listing_broker:   src.listing_broker,
      availability_type: 'For Sale',
      status:           'Available',
      notes:            src.notes ? `[Back on Market] ${src.notes}` : '[Moved back from Sale Comps — fill in asking price]',
    }

    const { error: insErr } = await supabase.from('market_availabilities').insert([avail])
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    await supabase.from('industrial_sale_comps').delete().eq('id', id)
    return NextResponse.json({ ok: true, moved: true, to: 'avails' })
  }

  // ── Lease Avail → Lease Comp when status = Leased ────────────────────────
  if (table === 'lease-avails' && status === 'Leased') {
    const { data: src, error: fetchErr } = await supabase
      .from('lease_market_availabilities').select('*').eq('id', id).single()
    if (fetchErr || !src) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

    const leaseComp: Record<string, unknown> = {
      address:              src.address,
      town:                 src.town,
      county:               src.county,
      building_sf:          src.building_sf,
      lot_size_ac:          src.lot_size_ac,
      ceiling_height:       src.ceiling_height,
      loading_docks:        src.loading_docks,
      drive_ins:            src.drive_ins,
      asking_rent:          src.asking_rent,
      rent_type:            src.rent_type,
      taxes:                src.taxes,
      lease_term_years:     src.lease_term_years,
      landlord:             src.landlord,
      notes:                src.notes ? `[From Avail] ${src.notes}` : '[Moved from Lease Availabilities — fill in deal rent, tenant, transaction date]',
      status:               'Active',
    }

    const { error: insErr } = await supabase.from('lease_comps').insert([leaseComp])
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    await supabase.from('lease_market_availabilities').delete().eq('id', id)
    return NextResponse.json({ ok: true, moved: true, to: 'lease-comps' })
  }

  // ── Default: just update status in place ─────────────────────────────────
  const tableName =
    table === 'comps'        ? 'industrial_sale_comps' :
    table === 'lease-comps'  ? 'lease_comps' :
    table === 'lease-avails' ? 'lease_market_availabilities' :
                               'market_availabilities'

  const { error } = await supabase.from(tableName).update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, moved: false })
}
