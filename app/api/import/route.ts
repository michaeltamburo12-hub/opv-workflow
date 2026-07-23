import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Detect column type from sample values
function detectType(values: string[]): 'number' | 'date' | 'text' {
  const sample = values.filter(v => v && v.trim()).slice(0, 20)
  if (!sample.length) return 'text'
  const numCount = sample.filter(v => !isNaN(Number(v.replace(/[$,%]/g, '')))).length
  if (numCount / sample.length > 0.8) return 'number'
  const dateCount = sample.filter(v => !isNaN(Date.parse(v))).length
  if (dateCount / sample.length > 0.8) return 'date'
  return 'text'
}

// POST /api/import — parse uploaded file, return columns + preview
// POST /api/import?action=insert — insert rows into Supabase table
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // ── CREATE TABLE then INSERT rows ─────────────────────────────────────────
  if (action === 'insert') {
    const { tableName, rows, createSQL } = await req.json() as { tableName: string, rows: Record<string, unknown>[], createSQL?: string }
    if (!tableName || !rows?.length) return NextResponse.json({ error: 'tableName and rows required' }, { status: 400 })

    // Auto-create table if SQL provided
    if (createSQL) {
      const { error: createErr } = await supabaseAdmin.rpc('exec_sql', { sql: createSQL })
      if (createErr) return NextResponse.json({ error: 'Failed to create table: ' + createErr.message }, { status: 500 })
      // Verify table was actually created
      const { data: tableCheck } = await supabaseAdmin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .single()
      if (!tableCheck) return NextResponse.json({ error: `Table "${tableName}" was not created. The exec_sql function may lack permissions. Please create the table manually in Supabase SQL Editor first, then import using "Existing Table".` }, { status: 500 })
    }

    // ── Table-aware column remapping — ALL data preserved, nothing dropped ────
    //
    // Priority order for a given incoming column name:
    //   1. Table-specific remap (e.g. sale_price → asking_price for avails)
    //   2. Universal synonym map (covers every variation from CoStar, LoopNet, PCRE PDFs)
    //   3. If the column exists as-is in the target table → use it
    //   4. If it still doesn't match → append value to notes so NO data is lost

    // Universal synonym map — covers every common variation across all sources
    const SYNONYMS: Record<string, string> = {
      // Address
      street_address:'address', property_address:'address', full_address:'address',
      building_address:'address', prop_address:'address',
      // City / location
      municipality:'city',
      // Building size
      building_size:'building_sf', building_size_sf:'building_sf', bldg_sf:'building_sf',
      total_sf:'building_sf', gla_sf:'building_sf', rentable_sf:'building_sf',
      rentable_building_area:'building_sf', gross_building_area:'building_sf',
      // Lot
      lot_size_ac:'lot_size_ac', land_area:'lot_size_ac', lot_acres:'lot_size_ac',
      land_area_ac:'lot_size_ac', site_area:'lot_size_ac',
      // Ceiling
      ceiling_height:'ceiling_height', clear_height:'ceiling_height',
      clear_ceiling_height:'ceiling_height', ceiling_ht:'ceiling_height',
      clr_ht:'ceiling_height', ceil_ht:'ceiling_height',
      // Docks / doors
      loading_docks:'loading_docks', dock_doors:'loading_docks', docks:'loading_docks',
      number_of_loading_docks:'loading_docks',
      drive_in_doors:'drive_ins', grade_level_doors:'drive_ins', drive_ins:'drive_ins',
      // Systems
      electric_service:'power', electrical_service:'power', electrical:'power', electric:'power',
      sprinkler_system:'sprinkler', fire_sprinklers:'sprinkler',
      sewer_connection:'sewer',
      // Taxes / zoning
      real_estate_taxes:'real_estate_taxes', re_taxes:'real_estate_taxes',
      annual_taxes:'real_estate_taxes', tax_amount:'real_estate_taxes',
      // Sale price (comps) — sale_price_text is remapped to sale_price for all tables
      // except pcre_sale_transactions which overrides it back via TABLE_REMAP
      sale_price_text:'sale_price', for_sale_price:'sale_price',
      transaction_price:'sale_price', sold_price:'sale_price', closed_price:'sale_price',
      // Asking price (avails)
      list_price:'asking_price', listed_price:'asking_price', for_sale:'asking_price',
      listing_price:'asking_price', offered_at:'asking_price',
      // Price per sf
      price_sf:'price_per_sf', price_per_sf:'price_per_sf', psf:'price_per_sf',
      'price/sf':'price_per_sf', ppsf:'price_per_sf',
      // Dates
      transaction_date:'sale_date', close_of_escrow:'sale_date', closed_date:'sale_date',
      closing_date:'sale_date', sold_date:'sale_date', sale_close_date:'sale_date',
      // Parties
      grantor:'seller', vendor:'seller', transferor:'seller',
      grantee:'buyer', purchaser:'buyer', transferee:'buyer',
      // Broker / market
      listing_agent:'listing_broker', broker:'listing_broker', agent:'listing_broker',
      sub_market:'submarket', submarket_area:'submarket',
      zip:'zip_code', postal_code:'zip_code',
      // Lease
      lease_rate:'lease_price', lease_psf:'lease_price', rent:'lease_price',
      annual_rent:'lease_price', base_rent:'lease_price',
      lease_start:'lease_date', commencement_date:'lease_date',
      lessee:'tenant', renter:'tenant',
      lessor:'landlord', owner:'landlord',
      term:'lease_term', lease_length:'lease_term',
      // PCRE text price
      sale_amount:'sale_price_text',
      // Lease comp column header variations (after normalization removes parens/dots/%)
      lot_size_if_applicable_:'lot_size_ac', lot_size_if_applicable:'lot_size_ac',
      ceiling_height_ft_:'ceiling_height', ceiling_height_ft:'ceiling_height',
      taxes_if_applicable_:'taxes', taxes_if_applicable:'taxes',
      lease_term_years_:'lease_term_years',
      rent_concession_months_:'rent_concession_months',
      ti__ll_work:'ti_ll_work', ti__ll_work_:'ti_ll_work',
      _mgmt_fee:'mgmt_fee_pct', mgmt_fee:'mgmt_fee_pct',
    }

    // Table-specific overrides (applied after synonyms)
    const TABLE_REMAP: Record<string, Record<string, string>> = {
      market_availabilities: {
        sale_price: 'asking_price',   // if sale_price slips through, it's asking_price for avails
        sale_date:  'notes',          // avails don't have sale dates — preserve in notes
      },
      pcre_sale_transactions: {
        sale_price: 'sale_price_text', // PCRE stores formatted text, not numeric
      },
      lease_comps: {
        sale_date:         'transaction_date',  // SYNONYMS maps transaction_date → sale_date; undo it
        city:              'town',              // column is "Town" not "City"
        lease_price:       'deal_rent',         // SYNONYMS maps lease_rate/rent → lease_price; remap
        lease_date:        'transaction_date',  // old field name
        lease_term:        'lease_term_years',  // old field name
        real_estate_taxes: 'taxes',             // synonym maps to real_estate_taxes; remap
        price_per_sf:      'deal_rent',         // rent psf variant
      },
    }

    // Canonical columns for each known table
    const TABLE_COLUMNS: Record<string, Set<string>> = {
      industrial_sale_comps: new Set(['address','city','county','state','zip_code','property_type','building_sf','lot_size_ac','ceiling_height','loading_docks','drive_ins','power','heat','parking','sprinkler','sewer','zoning','real_estate_taxes','sale_price','price_per_sf','sale_date','sale_type','buyer','seller','listing_broker','market','submarket','loopnet_url','notes','status']),
      market_availabilities: new Set(['address','city','county','state','zip_code','property_type','building_sf','lot_size_ac','ceiling_height','loading_docks','drive_ins','power','heat','parking','sprinkler','sewer','zoning','real_estate_taxes','asking_price','price_per_sf','pricing_guidance','availability_type','status','listing_broker','market','submarket','loopnet_url','notes']),
      pcre_sale_transactions: new Set(['address','city','county','property_type','building_sf','sale_price_text','sale_date','buyer','seller','notes']),
      pcre_lease_transactions: new Set(['address','city','county','tenant','landlord','building_sf','lease_price','lease_date','lease_term','notes']),
      lease_comps: new Set(['address','town','county','building_sf','lot_size_ac','ceiling_height','loading_docks','drive_ins','asking_rent','deal_rent','rent_type','taxes','lease_term_years','rent_concession_months','ti_ll_work','mgmt_fee_pct','tenant','landlord','transaction_date','status','notes']),
    }

    const TABLE_DEFAULTS: Record<string, Record<string, unknown>> = {
      industrial_sale_comps: { status: 'Closed', state: 'NY', sale_type: "Arm's Length" },
      market_availabilities: { status: 'Available', availability_type: 'For Sale', state: 'NY' },
      lease_comps: { status: 'Active', county: 'Nassau' },
    }

    const tableRemap  = TABLE_REMAP[tableName]  || {}
    const allowedCols = TABLE_COLUMNS[tableName] || null   // null = custom table, allow all
    const defaults    = TABLE_DEFAULTS[tableName] || {}

    const remappedRows: Record<string, unknown>[] = rows.map(row => {
      const out: Record<string, unknown> = { ...defaults }
      const overflow: string[] = []   // unmapped values appended to notes

      for (const [rawKey, v] of Object.entries(row)) {
        if (v === null || v === undefined || v === '') continue
        const val = v

        // Step 1: synonym → canonical name
        const synKey = SYNONYMS[rawKey] || rawKey

        // Step 2: table-specific override
        const finalKey = tableRemap[synKey] || synKey

        // Step 3: if this table has a whitelist, check it
        if (allowedCols) {
          if (allowedCols.has(finalKey)) {
            // Special: 'notes' target means append to notes string, not overwrite
            if (finalKey === 'notes') {
              overflow.push(`${rawKey}: ${val}`)
            } else {
              out[finalKey] = val
            }
          } else {
            // Column not in table — preserve value in notes rather than dropping it
            overflow.push(`${rawKey}: ${val}`)
          }
        } else {
          out[finalKey] = val
        }
      }

      // Merge overflow into notes
      if (overflow.length) {
        const existing = out.notes ? String(out.notes) + ' | ' : ''
        out.notes = existing + overflow.join(' | ')
      }

      // For pcre_sale_transactions: keep price as formatted text not numeric
      if (tableName === 'pcre_sale_transactions' && typeof out.sale_price_text === 'number') {
        out.sale_price_text = `$${Number(out.sale_price_text).toLocaleString()}`
      }

      return out
    })

    let inserted = 0, failed = 0, skipped = 0
    const skippedAddresses: string[] = []
    let firstError = ''
    const BATCH = 50

    // Duplicate detection — query with original-case addresses, compare lowercase
    let rowsToProcess = remappedRows
    const hasAddressCol = remappedRows.length > 0 && 'address' in remappedRows[0]
    if (hasAddressCol) {
      // Use original-case addresses for the DB query so .in() matches correctly
      const originalAddresses = remappedRows.map(r => (r.address as string)?.trim()).filter(Boolean)
      if (originalAddresses.length) {
        const existingSet = new Set<string>()
        const ADDR_BATCH = 500
        for (let i = 0; i < originalAddresses.length; i += ADDR_BATCH) {
          const batch = originalAddresses.slice(i, i + ADDR_BATCH)
          // Query exact matches first
          const { data: exactMatches } = await supabaseAdmin
            .from(tableName)
            .select('address')
            .in('address', batch)
          ;(exactMatches || []).forEach((r: { address: string }) => {
            if (r.address) existingSet.add(r.address.toLowerCase().trim())
          })
          // Also query case-insensitive for each address using ilike in small batches
          for (const addr of batch) {
            const { data: ilikeMatches } = await supabaseAdmin
              .from(tableName)
              .select('address')
              .ilike('address', addr.trim())
              .limit(1)
            ;(ilikeMatches || []).forEach((r: { address: string }) => {
              if (r.address) existingSet.add(r.address.toLowerCase().trim())
            })
          }
        }
        rowsToProcess = remappedRows.filter(r => {
          const addr = (r.address as string)?.toLowerCase().trim()
          if (addr && existingSet.has(addr)) {
            skippedAddresses.push(r.address as string)
            skipped++
            return false
          }
          return true
        })
      }
    }

    for (let i = 0; i < rowsToProcess.length; i += BATCH) {
      const batch = rowsToProcess.slice(i, i + BATCH)
      const { data, error } = await supabaseAdmin.from(tableName).insert(batch).select()
      if (error) { failed += batch.length; if (!firstError) firstError = error.message }
      else inserted += data?.length || 0
    }
    return NextResponse.json({ inserted, failed, skipped, skippedAddresses: skippedAddresses.slice(0, 20), total: rows.length, firstError })
  }

  // ── PARSE uploaded file ─────────────────────────────────────────────────────
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const fileName = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  let headers: string[] = []
  let rows: Record<string, string>[] = []

  try {
    if (fileName.endsWith('.csv') || fileName.endsWith('.tsv') || fileName.endsWith('.txt')) {
      // CSV / TSV parsing
      const text = buffer.toString('utf-8')
      const lines = text.trim().split('\n').filter(l => l.trim())
      if (lines.length < 2) return NextResponse.json({ error: 'File must have at least a header row and one data row' }, { status: 400 })
      const sep = fileName.endsWith('.tsv') ? '\t' : (lines[0].includes('\t') ? '\t' : ',')
      headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/[\s\-\/]+/g, '_').replace(/[^a-z0-9_]/g, ''))
      rows = lines.slice(1).map(line => {
        const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, i) => { row[h] = vals[i] || '' })
        return row
      })
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.numbers')) {
      // Excel / Numbers (Numbers exports as xlsx)
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
      if (!rawRows.length) return NextResponse.json({ error: 'No data found in file' }, { status: 400 })
      // Normalize headers
      const rawHeaders = Object.keys(rawRows[0])
      headers = rawHeaders.map(h => String(h).trim().toLowerCase().replace(/[\s\-\/]+/g, '_').replace(/[^a-z0-9_]/g, ''))
      rows = rawRows.map(r => {
        const row: Record<string, string> = {}
        rawHeaders.forEach((rh, i) => { row[headers[i]] = String(r[rh] ?? '') })
        return row
      })
    } else if (fileName.endsWith('.docx')) {
      // Parse DOCX using XLSX.CFB (no extra dependencies — DOCX is a ZIP+XML file)
      const cfb = XLSX.CFB.read(buffer, { type: 'buffer' })
      const docIdx = cfb.FileIndex.findIndex((f: { name: string }) => f.name === 'document.xml')
      if (docIdx < 0) return NextResponse.json({ error: 'Could not find document.xml in DOCX file' }, { status: 400 })
      const xml = Buffer.from(cfb.FileIndex[docIdx].content).toString('utf8')

      // Extract table rows: each <w:tr> = one row, each <w:tc> = one cell, text in <w:t>
      const tableRows: string[][] = []
      const trRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g
      let trMatch: RegExpExecArray | null
      while ((trMatch = trRe.exec(xml)) !== null) {
        const cells: string[] = []
        const tcRe = /<w:tc>[\s\S]*?<\/w:tc>/g
        let tcMatch: RegExpExecArray | null
        while ((tcMatch = tcRe.exec(trMatch[0])) !== null) {
          const texts: string[] = []
          const tRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g
          let tMatch: RegExpExecArray | null
          while ((tMatch = tRe.exec(tcMatch[0])) !== null) texts.push(tMatch[1])
          cells.push(texts.join('').trim())
        }
        if (cells.some(c => c)) tableRows.push(cells)
      }

      if (tableRows.length < 2) return NextResponse.json({ error: 'No table data found in DOCX' }, { status: 400 })

      // First non-empty row = headers; normalize them
      const rawHeaders = tableRows[0].filter(h => h)
      headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/[\s\-\/()]+/g, '_').replace(/[^a-z0-9_]/g, ''))

      // Quarter-date helper: "2nd Quarter 2026" → "2026-04-01"
      const quarterToDate = (s: string) => {
        const m = s.match(/(\d+)\w+\s+quarter\s+(\d{4})/i)
        if (!m) return s
        const qMap: Record<string,string> = {'1':'01','2':'04','3':'07','4':'10'}
        return `${m[2]}-${qMap[m[1]] || '01'}-01`
      }

      // Data rows: skip header row, skip blank rows
      const colCount = tableRows[0].length
      rows = tableRows.slice(1).filter(r => r.some(c => c)).map(r => {
        // Pad/align: some DOCX tables have a blank first column
        const aligned = r.length === colCount ? r : r.length === colCount - 1 ? ['', ...r] : r
        const row: Record<string, string> = {}
        rawHeaders.forEach((_, i) => {
          let val = (aligned[r.length === colCount ? i : i + 1] ?? '').trim()
          // Convert quarter dates
          if (/quarter/i.test(val)) val = quarterToDate(val)
          // Clean SF: remove commas
          if (headers[i] === 'building_size_sf_' || headers[i].includes('size')) val = val.replace(/,/g, '')
          row[headers[i]] = val
        })
        return row
      })

    } else if (fileName.endsWith('.pdf')) {
      const tableHint = searchParams.get('hint') || ''

      // Collect positioned text items — used by Parser C (coordinate-based)
      // and also generate properly-ordered text for Parsers A & B
      const allItems: {x: number, y: number, str: string}[] = []
      const pdfData = await pdfParse(buffer, {
        pagerender: async (pageData: any) => {
          const tc = await pageData.getTextContent()
          const lineMap = new Map<number, {x: number, str: string}[]>()
          for (const item of tc.items) {
            if (!('str' in item) || !item.str.trim()) continue
            const x = Math.round(item.transform[4])
            const y = (item as any).transform[5] as number
            allItems.push({ x, y, str: item.str.trim() })
            const yk = Math.round(y)
            if (!lineMap.has(yk)) lineMap.set(yk, [])
            lineMap.get(yk)!.push({ x, str: item.str })
          }
          return [...lineMap.entries()]
            .sort(([ya], [yb]) => yb - ya)
            .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.str).join(' '))
            .join('\n')
        }
      })
      const text = pdfData.text

      // ── PARSER C: coordinate-based table extraction ──────────────────────────────────────
      // Groups text items by their x/y positions — same approach as pdfplumber.
      // Uses county cell (Nassau/Suffolk at x≈161) as row anchor; assigns all nearby
      // items to the nearest anchor row. Much more reliable than text-only parsing.
      const isLeaseCompPDF =
        tableHint === 'lease_comps' ||
        (allItems.some(i => i.x >= 155 && i.x <= 200 && /^(Nassau|Suffolk)$/i.test(i.str)) &&
         allItems.some(i => i.x >= 396 && i.x <= 420 && i.str === '('))
      if (isLeaseCompPDF) {
        // ── Parser C: coordinate-based table extraction — works with any PDF format ───────
        //
        // How it works:
        //  1. Scan every y-level for a row that contains recognizable column header keywords.
        //     This detects the actual column positions regardless of page size, margins, or
        //     column order — so CoStar, LoopNet, PCRE, and any broker format all work.
        //  2. Build column x-boundaries dynamically from those detected positions.
        //  3. Find anchor rows: y-levels that have a date OR a county/city value in the
        //     expected column. Dual anchoring handles rows with blank dates.
        //  4. Assign every text item to its nearest anchor row, then map by x → column.
        //  5. Clean up values (money, dates, numbers) using format-agnostic patterns.

        // ── HEADER KEYWORD DICTIONARY ────────────────────────────────────────────────────
        // Covers PCRE, CoStar, LoopNet, and generic broker terminology.
        // Longer / more specific phrases listed first — first match wins.
        const HEADER_KW: [string, string][] = [
          // Date — many names across platforms
          ['transaction date','transaction_date'], ['execution date','transaction_date'],
          ['commencement date','transaction_date'], ['effective date','transaction_date'],
          ['lease date','transaction_date'],        ['signed date','transaction_date'],
          ['start date','transaction_date'],        ['close date','transaction_date'],
          ['lease start','transaction_date'],       ['date executed','transaction_date'],
          // Address
          ['street address','address'], ['property address','address'],
          ['building address','address'], ['property name','address'],
          // Town / City
          ['town','town'], ['city','town'], ['municipality','town'],
          // County / State / Market
          ['county','county'], ['state','county'], ['market','county'], ['submarket','county'],
          // Building size
          ['building size','building_sf'],   ['building sf','building_sf'],
          ['rentable sf','building_sf'],     ['available sf','building_sf'],
          ['total sf','building_sf'],        ['gross sf','building_sf'],
          ['leasable area','building_sf'],   ['lease sf','building_sf'],
          ['leased sf','building_sf'],       ['space size','building_sf'],
          // Lot size
          ['lot size','lot_size_ac'], ['land area','lot_size_ac'],
          ['lot acres','lot_size_ac'], ['site area','lot_size_ac'],
          // Ceiling / Clear height
          ['ceiling height','ceiling_height'], ['clear height','ceiling_height'],
          ['clearance','ceiling_height'],      ['ceiling','ceiling_height'],
          ['overhead clearance','ceiling_height'],
          // Loading docks
          ['loading docks','loading_docks'], ['dock doors','loading_docks'],
          ['loading','loading_docks'],        ['docks','loading_docks'],
          ['number of docks','loading_docks'],
          // Drive-ins / grade level
          ['drive-ins','drive_ins'],        ['drive ins','drive_ins'],
          ['grade level doors','drive_ins'], ['grade level','drive_ins'],
          ['drive in doors','drive_ins'],    ['drive','drive_ins'],
          // Asking rent
          ['asking rent','asking_rent'],  ['list price','asking_rent'],
          ['listed rent','asking_rent'],  ['marketed rent','asking_rent'],
          ['asking price','asking_rent'], ['asking','asking_rent'],
          // Deal / Lease rent
          ['deal rent','deal_rent'],       ['lease rate','deal_rent'],
          ['base rent','deal_rent'],       ['starting rent','deal_rent'],
          ['annual rent','deal_rent'],     ['monthly rent','deal_rent'],
          ['effective rent','deal_rent'],  ['net rent','deal_rent'],
          ['rent psf','deal_rent'],        ['rent/sf','deal_rent'],
          ['rate','deal_rent'],            ['deal','deal_rent'],
          // Rent type
          ['rent type','rent_type'], ['lease type','rent_type'],
          ['type','rent_type'],
          // Taxes
          ['real estate taxes','taxes'], ['re taxes','taxes'],
          ['annual taxes','taxes'],      ['tax amount','taxes'],
          ['taxes','taxes'],             ['tax','taxes'],
          // Lease term
          ['lease term','lease_term_years'], ['term years','lease_term_years'],
          ['term months','lease_term_years'], ['lease length','lease_term_years'],
          ['lease duration','lease_term_years'], ['term','lease_term_years'],
          // Rent concession
          ['rent concession','rent_concession_months'], ['free rent','rent_concession_months'],
          ['concession months','rent_concession_months'], ['concession','rent_concession_months'],
          // TI / LL Work
          ['tenant improvement','ti_ll_work'], ['t.i. allowance','ti_ll_work'],
          ['ti allowance','ti_ll_work'],       ['ti/ll work','ti_ll_work'],
          ['ti/ll','ti_ll_work'],              ['ll work','ti_ll_work'],
          ['t.i.','ti_ll_work'],               ['tia','ti_ll_work'],
          // Mgmt fee
          ['management fee','mgmt_fee_pct'], ['mgmt fee','mgmt_fee_pct'],
          ['management','mgmt_fee_pct'],
          // Tenant / Landlord
          ['tenant name','tenant'], ['lessee','tenant'], ['occupant','tenant'], ['tenant','tenant'],
          ['landlord name','landlord'], ['lessor','landlord'], ['owner','landlord'], ['landlord','landlord'],
          // Short/generic fallbacks (lower priority)
          ['address','address'], ['lot','lot_size_ac'], ['date','transaction_date'],
          ['fee','mgmt_fee_pct'],
        ]

        // ── STEP 1: group items by y-band and find the header row ────────────────────────
        const yBuckets = new Map<number, {x: number, str: string, y: number}[]>()
        for (const item of allItems) {
          const yk = Math.round(item.y / 4) * 4
          if (!yBuckets.has(yk)) yBuckets.set(yk, [])
          yBuckets.get(yk)!.push(item)
        }

        let headerCols: {field: string, x: number}[] = []
        let headerTopY = 0
        for (const [, items] of [...yBuckets.entries()].sort(([ya], [yb]) => yb - ya)) {
          const matched: {field: string, x: number}[] = []
          const seen = new Set<string>()
          for (const item of items.sort((a, b) => a.x - b.x)) {
            const norm = item.str.toLowerCase().replace(/[^a-z0-9\s\-\/\.]/g, ' ').replace(/\s+/g,' ').trim()
            for (const [kw, field] of HEADER_KW) {
              if (!seen.has(field) && norm.includes(kw)) {
                matched.push({ field, x: item.x }); seen.add(field); break
              }
            }
          }
          // Need ≥ 4 recognized columns AND (an address OR date column) to confirm it's a header
          if (matched.length >= 4 &&
              (matched.some(m => m.field === 'address') || matched.some(m => m.field === 'transaction_date'))) {
            if (matched.length > headerCols.length) {
              headerCols = matched
              headerTopY = Math.max(...items.map(i => i.y))
            }
          }
        }

        // ── STEP 2: build column x-boundaries ───────────────────────────────────────────
        let dynColNames: string[]
        let dynColX: number[]
        if (headerCols.length >= 4) {
          headerCols.sort((a, b) => a.x - b.x)
          dynColNames = headerCols.map(c => c.field)
          dynColX = headerCols.map(c => c.x)
        } else {
          // Hardcoded fallback for the PCRE lease comp format
          dynColNames = ['transaction_date','address','town','county','building_sf','lot_size_ac',
                         'ceiling_height','loading_docks','drive_ins','asking_rent','deal_rent',
                         'rent_type','taxes','lease_term_years','rent_concession_months',
                         'ti_ll_work','mgmt_fee_pct','tenant','landlord']
          dynColX     = [0, 99, 134, 161, 192, 221, 268, 302, 338, 365, 396, 423, 452, 496, 539, 601, 643, 671, 717]
          headerTopY  = allItems.length > 0 ? Math.max(...allItems.map(i => i.y)) + 1 : 9999
        }

        // Expand header zone downward to catch multi-line headers like:
        //   Line 1: "Lot Size"        ← detected as header at headerTopY
        //   Line 2: "(If applicable)" ← sits 10-15 units below, bleeds into data
        // Any item within 25 units below headerTopY that is parenthetical or matches
        // a header keyword is treated as part of the header band.
        let headerCutoffY = headerTopY  // items with y >= headerCutoffY are in header zone
        for (const item of allItems) {
          if (item.y < headerTopY && item.y >= headerTopY - 25) {
            const norm = item.str.toLowerCase().replace(/[^a-z0-9\s\-\/\.]/g, ' ').trim()
            const isSubLabel = /^\(/.test(item.str.trim()) || HEADER_KW.some(([kw]) => norm.includes(kw))
            if (isSubLabel) headerCutoffY = Math.min(headerCutoffY, item.y)
          }
        }
        headerCutoffY -= 3  // small buffer so the first real data row isn't clipped

        headers = [...new Set(dynColNames)]
        const getCol = (x: number): string => {
          let col = 0
          for (let i = 1; i < dynColX.length; i++) { if (x >= dynColX[i]) col = i }
          return dynColNames[col]
        }

        // Column x-ranges for anchor detection
        const dateIdx   = dynColNames.indexOf('transaction_date')
        const countyIdx = dynColNames.indexOf('county')
        const addrIdx   = dynColNames.indexOf('address')
        const dateXMin   = dateIdx   >= 0 ? dynColX[dateIdx]                                    : 0
        const dateXMax   = dateIdx   >= 0 && dateIdx   + 1 < dynColX.length ? dynColX[dateIdx   + 1] : 120
        const countyXMin = countyIdx >= 0 ? dynColX[countyIdx] - 5                              : 155
        const countyXMax = countyIdx >= 0 && countyIdx + 1 < dynColX.length ? dynColX[countyIdx + 1] - 5 : 220
        const addrXMin   = addrIdx   >= 0 ? dynColX[addrIdx]                                    : 90
        const addrXMax   = addrIdx   >= 0 && addrIdx   + 1 < dynColX.length ? dynColX[addrIdx   + 1] : 160

        // ── STEP 3: dual-anchor detection (date column + county/city column) ────────────
        // Using two anchor types means rows with blank dates are still captured.
        const DATE_RE = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^Q[1-4]\s*['´]?\s*\d{2,4}$/i
        const anchorYSet = new Set<number>()
        for (const item of allItems) {
          if (item.y > headerTopY + 5 || item.y >= headerCutoffY) continue  // skip title / header zone
          // Date column anchor
          if (item.x >= dateXMin && item.x < dateXMax && DATE_RE.test(item.str.trim()))
            anchorYSet.add(item.y)
          // County/city column anchor — any short text value (place name, state, market name)
          if (item.x >= countyXMin && item.x < countyXMax &&
              /^[A-Za-z]/.test(item.str) && item.str.length >= 2 && item.str.length <= 30 &&
              !/^(transaction|street|address|building|ceiling|loading|drive|asking|deal|rent|lease|taxes|term|concession|tenant|landlord|mgmt|management|county|town|city|lot|size|height|docks|type|date|fee|county|state|market)$/i.test(item.str))
            anchorYSet.add(item.y)
        }

        // Deduplicate anchors that are within 3 units of each other (same physical row)
        const rawAnchors = [...anchorYSet].sort((a, b) => b - a)
        const anchorYs: number[] = []
        for (const y of rawAnchors) {
          if (anchorYs.length === 0 || (anchorYs[anchorYs.length - 1] - y) > 3) anchorYs.push(y)
        }

        // ── STEP 4: normalize date strings ───────────────────────────────────────────────
        const normDate = (raw: string): string => {
          // MM/DD/YYYY or MM-DD-YYYY
          const m1 = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
          if (m1) return `${m1[3]}-${m1[1].padStart(2,'0')}-${m1[2].padStart(2,'0')}`
          // MM/DD/YY
          const m2 = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
          if (m2) return `20${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`
          // Q1 25 / Q4 2024
          const qm = raw.match(/Q([1-4])\s*['´]?\s*(\d{2,4})/i)
          if (qm) { const q: Record<string,string>={'1':'01','2':'04','3':'07','4':'10'}; const yr=qm[2].length===2?`20${qm[2]}`:qm[2]; return `${yr}-${q[qm[1]]}-01` }
          // Month name: "January 2025" or "Jan 2025"
          const mn = raw.match(/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(\d{4})/i)
          if (mn) { const mo: Record<string,string>={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; return `${mn[2]}-${mo[mn[1].slice(0,3).toLowerCase()]}-01` }
          return ''
        }

        // ── STEP 5: assign items to nearest anchor, build rows ───────────────────────────
        if (anchorYs.length > 0) {
          const rowBuckets = new Map<number, {x: number, str: string}[]>()
          for (const ay of anchorYs) rowBuckets.set(ay, [])
          for (const item of allItems) {
            if (item.y > headerTopY + 5 || item.y >= headerCutoffY) continue
            let nearest = anchorYs[0], minDist = Infinity
            for (const ay of anchorYs) { const d = Math.abs(item.y - ay); if (d < minDist) { minDist = d; nearest = ay } }
            rowBuckets.get(nearest)!.push({ x: item.x, str: item.str })
          }

          // ── STEP 6: build each row from its column items ─────────────────────────────
          // Lease type suffixes that may trail a rent figure
          const LEASE_TYPE_SUFFIX = /(?:\s*\/\s*(?:SF|yr|year|mo|month|sf\/yr|sf\/mo)\b)?(?:\s+(?:NNN|NN|Net|Gross|MG|Modified\s+Gross|FSG|Full\s+Service|FS|Industrial\s+Gross|IG))?/i
          const parseMoney = (v: string): string => {
            // "($ 18.00)" or "($18.00)" — PCRE negative format
            const p = v.match(/\(\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*SF(?:\/\s*YR)?)?\s*\)/)
            if (p) return p[1].replace(/,/g,'')
            // "$18.00", "$18.00/SF/YR", "$18.00 Gross", "$18.00/SF NNN"
            const d = v.match(new RegExp(`^\\$\\s*([\\d,]+(?:\\.\\d+)?)${LEASE_TYPE_SUFFIX.source}$`, 'i'))
            if (d) return d[1].replace(/,/g,'')
            // "18.00 NNN", "18.00 Gross", "18.00" — bare number with optional lease type suffix
            const n = v.match(new RegExp(`^([\\d,]+(?:\\.\\d+)?)${LEASE_TYPE_SUFFIX.source}$`, 'i'))
            if (n) return n[1].replace(/,/g,'')
            return v
          }

          rows = anchorYs.map(ay => {
            const items = rowBuckets.get(ay)!.sort((a, b) => a.x - b.x)
            const colMap: Record<string, string[]> = {}
            for (const item of items) {
              const col = getCol(item.x)
              if (!colMap[col]) colMap[col] = []
              colMap[col].push(item.str)
            }
            const row: Record<string, string> = { status: 'Active' }
            for (const [col, vals] of Object.entries(colMap)) {
              let val = vals.join(' ').trim()

              // Field-specific cleaning
              if (col === 'transaction_date')          val = normDate(val) || ''
              else if (col === 'deal_rent' || col === 'asking_rent' || col === 'taxes' || col === 'ti_ll_work')
                                                       val = parseMoney(val)
              else if (col === 'building_sf')          val = val.replace(/[,\s]/g,'').replace(/sf$/i,'').replace(/,/g,'')
              else if (col === 'ceiling_height')       { const m = val.match(/(\d+(?:\.\d+)?)/); val = m ? m[1] : '' }
              else if (col === 'lease_term_years')     { const m = val.match(/^(\d+(?:\.\d+)?)/); if (m) val = m[1] }
              else if (col === 'mgmt_fee_pct')         val = val.replace(/%/g,'').trim()
              else if (col === 'address')              val = val.replace(/,\s*$/, '').replace(/\s+/g,' ').trim()
              else if (col === 'lot_size_ac')          val = /^N\/?A$/i.test(val.trim()) ? '' : val

              // Safety net: numeric DB columns that contain no digits can't be valid values —
              // they're likely header bleed (e.g., "Lot Size (If applicable)") or stray labels.
              const NUMERIC_COLS = new Set(['building_sf','lot_size_ac','ceiling_height','loading_docks',
                                            'drive_ins','asking_rent','deal_rent','taxes',
                                            'lease_term_years','rent_concession_months','mgmt_fee_pct','ti_ll_work'])
              if (NUMERIC_COLS.has(col) && val && !/\d/.test(val)) val = ''

              if (val) row[col] = val
            }
            return row
          }).filter((r: Record<string,string>) => {
            // A valid data row must have at least 2 of these key fields filled in
            const keyFields = ['address','building_sf','deal_rent','asking_rent','tenant','transaction_date']
            return keyFields.filter(f => r[f]?.trim()).length >= 2
          })

          // If the address column was merged into another column name (e.g. property_name),
          // try to find a better address from an x-position near the addr column
          if (addrIdx >= 0) {
            rows.forEach((r: Record<string,string>) => {
              if (!r.address) {
                const addrItems = rowBuckets.get(
                  anchorYs.find(ay => rowBuckets.get(ay)?.some(i => i.x >= addrXMin && i.x < addrXMax && /\d/.test(i.str))) ?? anchorYs[0]
                ) || []
                const addrVal = addrItems.filter(i => i.x >= addrXMin && i.x < addrXMax).map(i => i.str).join(' ').replace(/,\s*$/,'').trim()
                if (addrVal) r.address = addrVal
              }
            })
          }
        }

      } else {

      // ── PARSER A: "date-per-row" format (MM/DD/YYYY or UNDER/IN CONTRACT at row start) ──
      const rowPattern = /^(\d{1,2}\/\d{1,2}\/\d{4}|UNDER CONTRACT|IN CONTRACT)/i
      const skipPatternA = /^(SALE COMPS|AVAILABILITIES|Transaction Date|IF:|Q[1-4]|::|Page \d)/i
      const blocksA: string[] = []
      let cur = ''
      for (const line of text.split('\n').map((l: string) => l.trim())) {
        if (!line || skipPatternA.test(line)) continue
        if (rowPattern.test(line)) { if (cur) blocksA.push(cur); cur = line }
        else if (cur) cur += ' ' + line
      }
      if (cur) blocksA.push(cur)

      if (blocksA.length > 0) {
        // Use existing field-extraction logic for this format
        headers = ['sale_date','address','city','county','building_sf','lot_size_ac','ceiling_height','loading_docks','drive_ins','sale_price','real_estate_taxes','buyer','sale_type']
        rows = blocksA.map((block: string) => {
          const row: Record<string,string> = {}
          const dateM = block.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/)
          if (dateM) { const [m,d,y] = dateM[1].split('/'); row.sale_date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; block = block.slice(dateM[0].length).trim() }
          else if (/^UNDER CONTRACT/i.test(block)) { row.sale_type = 'Under Contract'; block = block.replace(/^UNDER CONTRACT\s*/i,'') }
          else if (/^IN CONTRACT/i.test(block)) { row.sale_type = 'In Contract'; block = block.replace(/^IN CONTRACT\s*/i,'') }
          const countyM = block.match(/\b(NASSAU|SUFFOLK)\s*COUNTY\b/i)
          if (countyM) {
            row.county = countyM[1][0].toUpperCase() + countyM[1].slice(1).toLowerCase()
            const idx = block.toUpperCase().indexOf(countyM[0].toUpperCase())
            const before = block.slice(0,idx).trim(); const after = block.slice(idx+countyM[0].length).trim()
            const parts = before.split(/\s+/)
            const streetSuffix = /\b(ST|AVE|BLVD|DR|RD|CT|PL|PLZ|WAY|LN|CIR|TER|PKWY|HWY)\b/i
            let splitAt = -1; for (let i=parts.length-1;i>=0;i--) { if (streetSuffix.test(parts[i])){splitAt=i;break} }
            if (splitAt>=0&&splitAt<parts.length-1) { row.address=parts.slice(0,splitAt+1).join(' '); row.city=parts.slice(splitAt+1).join(' ') }
            else { row.address=parts.slice(0,-2).join(' '); row.city=parts.slice(-2).join(' ') }
            block = after
          }
          const sfM = block.match(/(\d[\d,]*)\s*SF\b/i); if (sfM) row.building_sf = sfM[1].replace(/,/g,'')
          const lotM = block.match(/([\d.]+)\s*ACRES?\b/i); if (lotM) row.lot_size_ac = lotM[1]
          const ceilM = block.match(/(\d+[''][^']*''?|\d+'\s*(?:to|-)\s*\d+'|\bTBD\b)/i); if (ceilM&&!/^\d+$/.test(ceilM[1])) row.ceiling_height=ceilM[1].trim()
          const priceMatches = [...block.matchAll(/\$\s*([\d,]+)(?!\s*PSF)/gi)]
          if (priceMatches.length) { const amounts=priceMatches.map(m=>parseInt(m[1].replace(/,/g,''),10)).filter(n=>!isNaN(n)); if (amounts.length) row.sale_price=String(Math.max(...amounts)) }
          const taxM = block.match(/\$\s*([\d,]+(?:\.\d+)?)\s*\(?\$?[\d.]+\s*PSF\)?/i); if (taxM) row.real_estate_taxes=taxM[1].replace(/,/g,'')
          const afterSF = block.replace(/[\d,]+\s*SF\b/i,'').replace(/([\d.]+)\s*ACRES?\b/i,'')
          const numTokens = afterSF.match(/\b(\d+)\b/g)||[]; if (numTokens[0]) row.loading_docks=numTokens[0]; if (numTokens[1]&&numTokens[1]!=='NONE') row.drive_ins=numTokens[1]
          const buyerM = block.match(/([A-Z][A-Za-z'.&,\s]+(?:LLC|Inc|Corp|Co|Ltd|360|Solutions|Industries|Technologies|Construction|Meats|Realty|Holdings?|Distributors?)\.?)\s*$/i); if (buyerM) row.buyer=buyerM[1].trim()
          return row
        }).filter((row: Record<string,string>) => row.address || row.sale_price)
      } else {
        // ── PARSER B: PCRE column-table format ──
        // The PDF is a multi-column table; pdfminer reads columns separately rather than row-by-row.
        // Strategy: classify every token, collect each type in order, then zip by index.
        const SKIP = /^(pcre|property address|property\s+type|building size|sale\s+price|transaction date|city|page \d|\d{3}[-.]\d{3}|\d{3}\.\d{3}|www\.|http|tel\b|fax\b)/i
        const SKIP_CHARS = /[│|@]/
        const QUARTER_DATE = /^(\d+)(st|nd|rd|th)\s+quarter\s+(\d{4})/i
        const PRICE_PAT = /^\$[\d,]+(\.\d+)?$|^undisclosed$/i
        const SF_PAT = /^[\d,]+$|^\d+\s*acres?$/i
        const TYPE_PAT = /^(industrial|investment|redevelopment|flex|warehouse|manufacturing|distribution|commercial|retail|office|medical)$/i
        const LEASE_PAT = /^\$[\d.,]+\s*(psf|gross|nnn|net|modified|mg)?$/i

        const quarterToIso = (s: string) => {
          const m = s.match(/(\d+)\w+\s+quarter\s+(\d{4})/i)
          if (!m) return ''
          const qMap: Record<string,string> = {'1':'01','2':'04','3':'07','4':'10'}
          return `${m[2]}-${qMap[m[1]] || '01'}-01`
        }
        const cleanSf = (s: string) => { const n = s.replace(/,/g,'').replace(/\s*acres?/i,'').trim(); return isNaN(Number(n)) ? '' : n }
        const toTitle = (s: string) => s.split(' ').map((w:string)=>w[0]?.toUpperCase()+(w.slice(1).toLowerCase()||'')).join(' ')

        const tokens = text.split('\n').map((l:string)=>l.trim()).filter((l:string)=>l && !SKIP.test(l) && !SKIP_CHARS.test(l))

        const addrs: string[] = [], cities: string[] = [], types: string[] = []
        const sfs: string[] = [], prices: string[] = [], dates: string[] = [], leasePrices: string[] = []

        // "last" tracks the most recent classified token type so we know when an
        // unclassified token is a city (it always follows an address token)
        let last = ''

        for (const tok of tokens) {
          if (QUARTER_DATE.test(tok)) { dates.push(quarterToIso(tok)); last='date' }
          else if (PRICE_PAT.test(tok)) { prices.push(tok); last='price' }
          else if (LEASE_PAT.test(tok) && !PRICE_PAT.test(tok)) { leasePrices.push(tok); last='price' }
          else if (SF_PAT.test(tok)) { sfs.push(cleanSf(tok)); last='sf' }
          else if (TYPE_PAT.test(tok)) { types.push(toTitle(tok)); last='type' }
          else if (/^\d[\d-]*\s+\S/.test(tok)) { addrs.push(toTitle(tok)); last='addr' }
          else if (last === 'addr') { cities.push(toTitle(tok)); last='city' }
          // else: noise / header fragment — skip
        }

        // Detect whether this is a sales or lease PDF
        const isLease = leasePrices.length > prices.length
        const finalPrices = isLease ? leasePrices : prices
        const n = Math.min(addrs.length, finalPrices.length, dates.length)

        if (n === 0) {
          return NextResponse.json({ error: 'Could not parse PDF. Please convert to CSV and use the Paste CSV option instead.' }, { status: 400 })
        }

        if (isLease) {
          headers = ['address','city','building_sf','lease_price','lease_date']
          rows = Array.from({length:n},(_,i) => ({
            address: addrs[i]||'', city: cities[i]||'',
            building_sf: sfs[i]||'', lease_price: finalPrices[i]||'', lease_date: dates[i]||''
          }))
        } else {
          const cleanPrice = (s: string) => s.replace(/[$,]/g, '').trim()
          headers = ['address','city','property_type','building_sf','sale_price','sale_date']
          rows = Array.from({length:n},(_,i) => ({
            address: addrs[i]||'', city: cities[i]||'',
            property_type: types[i]||'Industrial', building_sf: sfs[i]||'',
            sale_price: cleanPrice(finalPrices[i]||''), sale_date: dates[i]||''
          }))
        }
      }
      } // end else (Parser A / Parser B)
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, CSV, TSV, XLSX, or XLS.' }, { status: 400 })
    }

    // Remove empty header columns
    headers = headers.filter(h => h && h !== '_')

    // Remap common column name variations to canonical names
    const COLUMN_ALIASES: Record<string,string> = {
      street_address:'address', property_address:'address', full_address:'address', building_address:'address',
      building_size:'building_sf', building_size_sf_:'building_sf', bldg_sf:'building_sf', total_sf:'building_sf', rentable_building_area:'building_sf',
      ceiling_ht:'ceiling_height', ceil_ht:'ceiling_height', clr_ht:'ceiling_height',
      clear_ceiling_height:'ceiling_height', clear_height:'ceiling_height',
      number_of_loading_docks:'loading_docks', dock_doors:'loading_docks', docks:'loading_docks',
      drive_in_doors:'drive_ins', grade_level_doors:'drive_ins',
      electric_service:'power', electrical_service:'power', electrical:'power',
      sewer_connection:'sewer',
      sprinkler_system:'sprinkler', fire_sprinklers:'sprinkler',
      lot_size_ac_:'lot_size_ac', land_area:'lot_size_ac', lot_acres:'lot_size_ac',
      list_price:'asking_price', for_sale_price:'asking_price',
      transaction_date:'sale_date', close_of_escrow:'sale_date', asking_price_:'asking_price',
      grantor:'seller', grantee:'buyer',
      re_taxes:'real_estate_taxes', annual_taxes:'real_estate_taxes',
    }
    headers = headers.map(h => COLUMN_ALIASES[h] || h)
    // Update rows to use new header names
    rows = rows.map(row => {
      const newRow: Record<string,string> = {}
      Object.entries(row).forEach(([k, v]) => { newRow[COLUMN_ALIASES[k] || k] = v })
      return newRow
    })

    // Detect column types
    const columnTypes = headers.map(h => ({
      name: h,
      type: detectType(rows.map(r => r[h] || ''))
    }))

    // Get list of existing Supabase tables
    const { data: tableData } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE')
    const existingTables = (tableData || []).map((t: Record<string, string>) => t.table_name).filter((n: string) => !n.startsWith('_'))

    // Generate CREATE TABLE SQL for new table option
    const generateCreateSQL = (tableName: string) => {
      const colDefs = columnTypes.map(c => {
        const pgType = c.type === 'number' ? 'numeric' : c.type === 'date' ? 'date' : 'text'
        return `  ${c.name.padEnd(30)} ${pgType}`
      }).join(',\n')
      return `CREATE TABLE public.${tableName} (\n  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n${colDefs},\n  created_at timestamptz DEFAULT now()\n);\n\nALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Allow all" ON public.${tableName} FOR ALL USING (true) WITH CHECK (true);`
    }

    return NextResponse.json({
      headers,
      columnTypes,
      totalRows: rows.length,
      preview: rows.slice(0, 8),
      allRows: rows,
      existingTables,
      fileName: file.name,
      _debug: { totalRows: rows.length },
    })
  } catch (err) {
    return NextResponse.json({ error: `Parse error: ${(err as Error).message}` }, { status: 500 })
  }
}
