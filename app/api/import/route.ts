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

    let inserted = 0, failed = 0
    let firstError = ''
    const BATCH = 50
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { data, error } = await supabaseAdmin.from(tableName).insert(batch).select()
      if (error) { failed += batch.length; if (!firstError) firstError = error.message }
      else inserted += data?.length || 0
    }
    return NextResponse.json({ inserted, failed, total: rows.length, firstError })
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
      const pdfData = await pdfParse(buffer)
      const text = pdfData.text

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
          headers = ['address','city','property_type','building_sf','sale_price_text','sale_date']
          rows = Array.from({length:n},(_,i) => ({
            address: addrs[i]||'', city: cities[i]||'',
            property_type: types[i]||'Industrial', building_sf: sfs[i]||'',
            sale_price_text: finalPrices[i]||'', sale_date: dates[i]||''
          }))
        }
      }
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
      transaction_date:'sale_date', close_of_escrow:'sale_date', sale_price:'sale_price_text', asking_price_:'asking_price',
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
    })
  } catch (err) {
    return NextResponse.json({ error: `Parse error: ${(err as Error).message}` }, { status: 500 })
  }
}
