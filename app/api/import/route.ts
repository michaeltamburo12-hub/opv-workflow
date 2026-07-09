import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

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
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use CSV, TSV, XLSX, or XLS.' }, { status: 400 })
    }

    // Remove empty header columns
    headers = headers.filter(h => h && h !== '_')

    // Remap common column name variations to canonical names
    const COLUMN_ALIASES: Record<string,string> = {
      street_address:'address', property_address:'address', full_address:'address', building_address:'address',
      building_size:'building_sf', bldg_sf:'building_sf', total_sf:'building_sf', rentable_building_area:'building_sf',
      ceiling_ht:'ceiling_height', ceil_ht:'ceiling_height', clr_ht:'ceiling_height',
      clear_ceiling_height:'ceiling_height', clear_height:'ceiling_height',
      number_of_loading_docks:'loading_docks', dock_doors:'loading_docks', docks:'loading_docks',
      drive_in_doors:'drive_ins', grade_level_doors:'drive_ins',
      electric_service:'power', electrical_service:'power', electrical:'power',
      sewer_connection:'sewer',
      sprinkler_system:'sprinkler', fire_sprinklers:'sprinkler',
      lot_size_ac_:'lot_size_ac', land_area:'lot_size_ac', lot_acres:'lot_size_ac',
      list_price:'asking_price', for_sale_price:'asking_price',
      transaction_date:'sale_date', close_of_escrow:'sale_date',
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
