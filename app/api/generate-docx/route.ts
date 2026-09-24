export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  AlignmentType, WidthType, ShadingType, BorderStyle, PageBreak, ImageRun,
  HeadingLevel,
} from 'docx'

// ── Constants ──────────────────────────────────────────────────────────────
const NAVY       = '1C3557'
const LGRAY      = 'F2F2F2'
const WHITE      = 'FFFFFF'
const W          = 9360
const HALF       = Math.floor(W / 2)
const L_COL      = 2800
const V_COL      = W - L_COL
const thinBorder = { style: BorderStyle.SINGLE, size: 4,  color: 'CCCCCC' }
const navyBorder = { style: BorderStyle.SINGLE, size: 12, color: NAVY }
const noBorder   = { style: BorderStyle.NONE,   size: 0,  color: 'FFFFFF' }

const fmtDollar = (v: any) => v ? `$${Number(v).toLocaleString()}` : '—'
const fmtDate   = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'
const str       = (v: any) => (v != null && v !== '') ? String(v) : '—'

// ── Image helpers ──────────────────────────────────────────────────────────
async function fetchImg(src: string): Promise<Buffer | null> {
  if (!src) return null
  try {
    if (src.startsWith('data:')) {
      const comma = src.indexOf(',')
      if (comma === -1) return null
      return Buffer.from(src.slice(comma + 1), 'base64')
    }
    let url = src
    if (src.includes('/api/proxy-image?url=')) {
      url = decodeURIComponent(src.split('?url=')[1] || '')
    }
    if (!url.startsWith('http')) return null
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}

function loadPublicFile(filename: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'public', filename))
  } catch (e) {
    console.error(`loadPublicFile failed for ${filename}:`, e)
    return null
  }
}

function makeImageRun(buf: Buffer, width: number, height: number): ImageRun | null {
  for (const type of ['jpeg', 'png', 'jpg', 'gif'] as const) {
    try {
      return new ImageRun({ data: buf, transformation: { width, height }, type })
    } catch { continue }
  }
  return null
}

function photoRow(buf: Buffer | null, label = 'PROPERTY PHOTO'): TableRow {
  const imgRun = buf ? makeImageRun(buf, 600, 360) : null
  const child = imgRun
    ? new Paragraph({ children: [imgRun], spacing: { before: 60, after: 60 } })
    : new Paragraph({
        children: [new TextRun({ text: `[ ${label} ]`, bold: true, size: 22, color: '888888', font: 'Arial' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
      })
  return new TableRow({
    children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      columnSpan: 2,
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
      children: [child],
    })],
  })
}

// ── Text helpers ──────────────────────────────────────────────────────────
function run(text: string, opts: { bold?: boolean; size?: number; color?: string; italic?: boolean; allCaps?: boolean } = {}) {
  return new TextRun({ text, font: 'Arial', size: opts.size ?? 18, bold: opts.bold, color: opts.color, italics: opts.italic, allCaps: opts.allCaps })
}

function para(children: TextRun[], spacing = { before: 0, after: 80 }, align?: AlignmentType) {
  return new Paragraph({ children, spacing, alignment: align })
}

function spacer() { return new Paragraph({ children: [], spacing: { before: 0, after: 100 } }) }
function pageBreak() { return new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }) }

function bullet(text: string) {
  return new Paragraph({
    children: [run('•  ' + text, { size: 18 })],
    indent: { left: 360 },
    spacing: { before: 60, after: 60 },
  })
}

function sectionTitle(text: string) {
  return new Paragraph({
    children: [run(text, { bold: true, size: 24, color: NAVY, allCaps: true })],
    spacing: { before: 400, after: 200 },
    border: { bottom: navyBorder, top: noBorder, left: noBorder, right: noBorder },
    heading: HeadingLevel.HEADING_1,
  })
}

function subTitle(text: string) {
  return new Paragraph({
    children: [run(text, { bold: true, size: 20, color: NAVY })],
    spacing: { before: 240, after: 120 },
    heading: HeadingLevel.HEADING_2,
  })
}

function compTitle(text: string) {
  return new Paragraph({
    children: [run(text, { bold: true, size: 18, color: NAVY })],
    spacing: { before: 200, after: 80 },
    heading: HeadingLevel.HEADING_3,
  })
}

// ── Table helpers ─────────────────────────────────────────────────────────
function labelRow(label: string, value: string, shade = false) {
  const fill = shade ? LGRAY : WHITE
  return new TableRow({ children: [
    new TableCell({
      width: { size: L_COL, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill },
      borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      children: [new Paragraph({ children: [run(label, { bold: true, size: 17 })], spacing: { before: 50, after: 50 } })],
    }),
    new TableCell({
      width: { size: V_COL, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill },
      borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      children: [new Paragraph({ children: [run(value || '—', { size: 17 })], spacing: { before: 50, after: 50 } })],
    }),
  ]})
}

function propTable(rows: [string, string, boolean?][]) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [L_COL, V_COL],
    rows: rows.map(([l, v, s]) => labelRow(l, v, !!s)),
  })
}

function gridRow(pair1: [string, string], pair2?: [string, string], shade = false) {
  const fill = shade ? LGRAY : WHITE
  const makeCell = (label: string, value: string) => new TableCell({
    width: { size: HALF, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill },
    borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
    children: [new Paragraph({
      children: [run(label ? label + '  ' : '', { bold: true, size: 17 }), run(value || '—', { size: 17 })],
      spacing: { before: 50, after: 50 },
    })],
  })
  return new TableRow({
    children: [
      makeCell(pair1[0], pair1[1]),
      makeCell(pair2 ? pair2[0] : '', pair2 ? pair2[1] : ''),
    ],
  })
}

function compGrid(pairs: [string, string][]): Table {
  const rows: TableRow[] = []
  for (let i = 0; i < pairs.length; i += 2) {
    rows.push(gridRow(pairs[i], pairs[i + 1], Math.floor(i / 2) % 2 === 1))
  }
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [HALF, HALF], rows })
}

function summaryHeaderRow(headers: string[]) {
  const colW = Math.floor(W / headers.length)
  return new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: i === headers.length - 1 ? W - colW * (headers.length - 1) : colW, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: NAVY },
      borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      children: [new Paragraph({ children: [run(h, { bold: true, size: 16, color: 'FFFFFF' })], spacing: { before: 40, after: 40 } })],
    })),
  })
}

function summaryDataRow(vals: string[], shade = false) {
  const colW = Math.floor(W / vals.length)
  return new TableRow({
    children: vals.map((v, i) => new TableCell({
      width: { size: i === vals.length - 1 ? W - colW * (vals.length - 1) : colW, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: shade ? LGRAY : WHITE },
      borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      children: [new Paragraph({ children: [run(v || '—', { size: 16 })], spacing: { before: 40, after: 40 } })],
    })),
  })
}

function summaryTable(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    rows: [summaryHeaderRow(headers), ...rows.map((r, i) => summaryDataRow(r, i % 2 === 1))],
  })
}

// ── Main handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      subject, comps = [], leaseComps = [], leaseAvails = [], avails = [],
      analytics, aiText = '',
      includeLeaseComps, includeAvails, includeMarketingStrategy,
      photoUrls = {},
    } = await req.json()

    if (!subject) return NextResponse.json({ error: 'No subject data' }, { status: 400 })

    const photoCount = Object.values(photoUrls as Record<string,string>).filter(Boolean).length
    console.log(`generate-docx: ${photoCount} photoUrls received`)

    const isLease = subject.opvType === 'lease'
    const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    // Load PCRE assets from public/ at runtime
    const logoBuf    = loadPublicFile('pcre-logo.png')
    const jeffBuf    = loadPublicFile('jeff.png')
    const jasonBuf   = loadPublicFile('jason.png')
    const desmondBuf = loadPublicFile('desmond.png')
    console.log(`generate-docx: logo=${!!logoBuf} jeff=${!!jeffBuf} jason=${!!jasonBuf} desmond=${!!desmondBuf}`)

    const children: (Paragraph | Table)[] = []

    // ── COVER PAGE ──────────────────────────────────────────────────────────
    if (logoBuf) {
      const logoRun = makeImageRun(logoBuf, 240, 59)
      if (logoRun) {
        children.push(new Paragraph({ children: [logoRun], spacing: { before: 0, after: 200 } }))
      } else {
        children.push(para([run('PREMIER COMMERCIAL REAL ESTATE', { bold: true, size: 28, color: NAVY })], { before: 0, after: 200 }))
      }
    } else {
      children.push(para([run('PREMIER COMMERCIAL REAL ESTATE', { bold: true, size: 28, color: NAVY })], { before: 0, after: 200 }))
    }

    children.push(
      para([run('OPINION OF VALUE', { bold: true, size: 36, color: NAVY, allCaps: true })], { before: 0, after: 120 }),
      spacer(),
      para([run('Prepared For', { italic: true, size: 20, color: '555555' })], { before: 0, after: 40 }),
      para([run(subject.address || '[SUBJECT PROPERTY ADDRESS]', { bold: true, size: 24, color: NAVY })], { before: 0, after: 40 }),
    )
    if (subject.city) {
      children.push(para([run(`${subject.city}, New York`, { size: 22, color: '333333' })], { before: 0, after: 40 }))
    }
    children.push(spacer(), para([run(monthYear, { italic: true, size: 20, color: '555555' })], { before: 0, after: 200 }))

    // Subject photo on cover
    const subjectBuf = await fetchImg((photoUrls as any)['subject'] || '')
    if (subjectBuf) {
      const imgRun = makeImageRun(subjectBuf, 540, 320)
      if (imgRun) children.push(new Paragraph({ children: [imgRun], spacing: { before: 80, after: 200 } }))
    }

    children.push(spacer())

    // Broker contacts
    const noBord  = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' }
    const brdLine = { style: BorderStyle.SINGLE,  size: 6, color: 'CCCCCC' }
    const brokerColW = Math.floor(W / 3)

    const makeBrokerCell = (photo: Buffer | null, name: string, title: string, phone: string, email: string) => {
      const ps: Paragraph[] = []
      if (photo) {
        const imgRun = makeImageRun(photo, 72, 90)
        if (imgRun) ps.push(new Paragraph({ children: [imgRun], spacing: { before: 0, after: 60 } }))
      }
      ps.push(
        new Paragraph({ children: [run(name, { bold: true, size: 18 })],       spacing: { before: 0, after: 20 } }),
        new Paragraph({ children: [run(title, { size: 16, italic: true })],    spacing: { before: 0, after: 20 } }),
        new Paragraph({ children: [run(phone, { size: 16 })],                  spacing: { before: 0, after: 20 } }),
        new Paragraph({ children: [run(email, { size: 16 })],                  spacing: { before: 0, after: 0  } }),
      )
      return new TableCell({
        width: { size: brokerColW, type: WidthType.DXA },
        borders: { top: brdLine, bottom: brdLine, left: noBord, right: noBord },
        children: ps,
      })
    }

    children.push(new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [brokerColW, brokerColW, brokerColW],
      rows: [new TableRow({ children: [
        makeBrokerCell(jeffBuf,    'Jeff Schwartzberg',   'Managing Principal',          '516-857-8013', 'Jbs@pcrellc.com'),
        makeBrokerCell(jasonBuf,  'Jason Miller',         'Managing Principal',          '516-413-1690', 'Jmiller@pcrellc.com'),
        makeBrokerCell(desmondBuf,'Desmond Mullins',      'Partner, Executive Director', '631-398-5654', 'Dmullins@pcrellc.com'),
      ]})],
    }))

    children.push(spacer(), para([run('Premier Commercial Real Estate, LLC', { italic: true, size: 17, color: '555555' })], { before: 80, after: 0 }))
    children.push(pageBreak())

    // ── SECTION I: EXECUTIVE SUMMARY ───────────────────────────────────────
    children.push(sectionTitle('SECTION I — EXECUTIVE SUMMARY'))
    children.push(subTitle('Purpose of Opinion'))
    children.push(para([
      run('This Opinion of Value has been prepared to determine the fair market value of the subject property for ', { size: 18 }),
      run(isLease ? 'Lease.' : 'Sale.', { bold: true, size: 18 }),
    ]))
    children.push(spacer())
    children.push(propTable([
      ['Date of Opinion',    monthYear,                  false],
      ['Property Address',   subject.address || '—',     true],
      ['Tax Map Number',     subject.parcelId || '—',    false],
      ['Local Municipality', subject.municipality || '—',true],
      ['County',             subject.county || '—',      false],
    ]))
    children.push(spacer())
    children.push(subTitle('Property Summary Highlights & Assumptions'))
    const highlights: string[] = []
    if (subject.size)    highlights.push(`The building is approximately ${Number(subject.size).toLocaleString()} sq. ft. in total.`)
    if (subject.lot)     highlights.push(`The building sits on a parcel of approximately ${subject.lot} acres.`)
    if (subject.ceiling) highlights.push(`Ceiling height of ${subject.ceiling}' clear.`)
    if (subject.docks || subject.driveIn) highlights.push(`${subject.docks || '—'} loading dock(s) and ${subject.driveIn || '—'} drive-in door(s).`)
    if (subject.sprinkler) highlights.push(`${subject.sprinkler} sprinkler system.`)
    if (subject.sewer)   highlights.push(`Sewer: ${subject.sewer}.`)
    if (subject.power)   highlights.push(`Electrical service: ${subject.power}.`)
    if (subject.taxes)   highlights.push(`Real Estate Taxes are $${Number(subject.taxes).toLocaleString()}${subject.size ? ` ($${(Number(subject.taxes)/Number(subject.size)).toFixed(2)}/SF)` : ''}.`)
    if (subject.notes)   highlights.push(subject.notes)
    highlights.forEach(h => children.push(bullet(h)))
    children.push(spacer())
    children.push(subTitle('Highest and Best Use(s)'))
    const hbu: string[] = subject.highestBestUse
      ? subject.highestBestUse.split('\n').filter(Boolean)
      : ['Manufacturing', 'Wholesale Operation', 'Warehouse / Distribution']
    hbu.forEach((u: string) => children.push(bullet(u.trim())))
    children.push(pageBreak())

    // ── SECTION II: BUILDING DESCRIPTION ───────────────────────────────────
    children.push(sectionTitle('SECTION II — BUILDING DESCRIPTION'))
    if (subjectBuf) {
      children.push(new Table({
        width: { size: W, type: WidthType.DXA },
        columnWidths: [HALF, HALF],
        rows: [photoRow(subjectBuf)],
      }))
    }
    const descRows: [string, string, boolean?][] = [
      ['PROPERTY ADDRESS',   `${subject.address || '—'}${subject.city ? ', ' + subject.city : ''}`, false],
      ['TOTAL BUILDING SF',  subject.size ? `${Number(subject.size).toLocaleString()} SF` : '—',     true],
    ]
    if (subject.officePct) descRows.push(['OFFICE', `${subject.officePct}%`, false])
    descRows.push(
      ['TOTAL SITE ACREAGE', subject.lot ? `${subject.lot} AC` : '—',   true],
      ['CEILING HEIGHT',     subject.ceiling ? `${subject.ceiling}' clear` : '—', false],
      ['DRIVE-INS',          subject.driveIn || '—',                     true],
      ['LOADING DOCKS',      subject.docks || '—',                       false],
      ['HEAT',               subject.heat || '—',                        true],
      ['POWER',              subject.power || '—',                       false],
      ['PARKING',            subject.parking || '—',                     true],
      ['SPRINKLER SYSTEM',   subject.sprinkler || '—',                   false],
      ['SEWER CONNECTION',   subject.sewer || '—',                       true],
      ['ZONING',             subject.zoning || '—',                      false],
      ['REAL ESTATE TAXES',  subject.taxes ? `$${Number(subject.taxes).toLocaleString()}/yr${subject.size ? ` ($${(Number(subject.taxes)/Number(subject.size)).toFixed(2)}/SF)` : ''}` : '—', true],
    )
    if (subject.yearBuilt)    descRows.push(['YEAR BUILT',   subject.yearBuilt,    false])
    if (subject.construction) descRows.push(['CONSTRUCTION', subject.construction, true])
    if (subject.condition)    descRows.push(['CONDITION',    subject.condition,    false])
    children.push(propTable(descRows))
    children.push(pageBreak())

    // ── SECTION III: OPINION OF VALUE ──────────────────────────────────────
    children.push(sectionTitle('SECTION III — OPINION OF VALUE'))
    children.push(para([run('Based upon the aforementioned assumptions, our knowledge of current market conditions, and a review of the Comparables, it is our opinion that as of this date the Property has a fair market value of:', { size: 18 })], { before: 0, after: 120 }))
    if (isLease) {
      const low  = subject.leasePsfLow  || analytics?.leaseLow
      const high = subject.leasePsfHigh || analytics?.leaseHigh
      children.push(propTable([
        ['ESTIMATED VALUE FOR LEASE',      low && high ? `$${low} – $${high} per SF per year — NNN` : '—', false],
        ['RECOMMENDED ASKING LEASE PRICE', analytics?.leaseSuggested ? `$${Number(analytics.leaseSuggested).toFixed(2)} per SF per year — NNN` : high ? `$${high} per SF per year — NNN` : '—', true],
      ]))
    } else {
      children.push(propTable([
        ['ESTIMATED VALUE FOR SALE',      subject.estimatedValueLow && subject.estimatedValueHigh ? `$${Number(subject.estimatedValueLow).toLocaleString()} – $${Number(subject.estimatedValueHigh).toLocaleString()}` : '—', false],
        ['RECOMMENDED ASKING SALE PRICE', analytics?.suggestedAskingPrice ? `$${Number(analytics.suggestedAskingPrice).toLocaleString()}` : subject.estimatedValueHigh ? `$${Number(subject.estimatedValueHigh).toLocaleString()}` : '—', true],
      ]))
    }
    children.push(pageBreak())

    // ── SECTION IV: LEASE COMPS ────────────────────────────────────────────
    if (leaseComps.length > 0 && (isLease || includeLeaseComps)) {
      children.push(sectionTitle('SECTION IV — RECENT LEASE TRANSACTIONS'))
      children.push(subTitle('Summary'))
      children.push(summaryTable(
        ['Property Address', 'Town', 'Building SF', 'Rent PSF (Type)'],
        leaseComps.map((c: any) => [
          c.address || '—', c.town || '—',
          c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—',
          c.deal_rent ? `$${Number(c.deal_rent).toFixed(2)}/SF/yr${c.rent_type ? ' — ' + c.rent_type : ''}` : c.asking_rent ? `$${Number(c.asking_rent).toFixed(2)}/SF/yr (Ask)` : '—',
        ])
      ))
      children.push(spacer())
      for (let i = 0; i < leaseComps.length; i++) {
        const c = leaseComps[i]
        children.push(compTitle(`Comparable Lease Transaction #${i + 1} — ${c.address || ''}${c.town ? ', ' + c.town : ''}`))
        const photoBuf = await fetchImg((photoUrls as any)[c.id] || '')
        if (photoBuf) {
          children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [HALF, HALF], rows: [photoRow(photoBuf)] }))
        }
        children.push(compGrid([
          ['Building Size', c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—'],
          ['Lot Size', c.lot_size_ac ? `${c.lot_size_ac} AC` : '—'],
          ['Office SF', c.office_sf ? `${Number(c.office_sf).toLocaleString()} SF` : '—'],
          ['Ceiling Height', c.ceiling_height ? `${c.ceiling_height} ft` : '—'],
          ['Loading Docks', str(c.loading_docks)],
          ['Drive-Ins', str(c.drive_ins)],
          ['Power', str(c.power)],
          ['Heat', str(c.heat)],
          ['Sprinklers', str(c.sprinkler)],
          ['Parking', str(c.parking)],
          ['Sewer', str(c.sewer)],
          ['Zoning', str(c.zoning)],
          ['RE Taxes', c.re_taxes ? `$${Number(c.re_taxes).toLocaleString()}/yr` : '—'],
          ['Lease Price', c.deal_rent ? `$${Number(c.deal_rent).toFixed(2)} PSF/yr${c.rent_type ? ' — ' + c.rent_type : ''}` : c.asking_rent ? `$${Number(c.asking_rent).toFixed(2)} PSF/yr (Ask)` : '—'],
          ['Term', c.lease_term_years ? `${c.lease_term_years} years` : '—'],
          ['Escalations', str(c.escalations)],
          ['Concession', c.rent_concession_months ? `${c.rent_concession_months} months` : '—'],
          ['LL Work', str(c.ti_ll_work)],
          ['Tenant', str(c.tenant)],
          ['Landlord', str(c.landlord)],
          ['Transaction Date', fmtDate(c.transaction_date)],
        ]))
        if (c.notes) children.push(spacer(), para([run('Notes:  ', { bold: true, size: 17 }), run(c.notes, { size: 17, italic: true })], { before: 40, after: 40 }))
        children.push(spacer())
      }
    }

    if (leaseAvails.length > 0 && (isLease || includeAvails)) {
      children.push(subTitle('Market Lease Availabilities'))
      children.push(summaryTable(
        ['Property Address', 'Town', 'Building SF', 'Asking Rent'],
        leaseAvails.map((a: any) => [
          a.address || '—', a.town || '—',
          a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—',
          a.asking_rent ? `$${Number(a.asking_rent).toFixed(2)}/SF/yr${a.rent_type ? ' — ' + a.rent_type : ''}` : '—',
        ])
      ))
      children.push(spacer())
      for (let i = 0; i < leaseAvails.length; i++) {
        const a = leaseAvails[i]
        children.push(compTitle(`Lease Availability #${i + 1} — ${a.address || ''}${a.town ? ', ' + a.town : ''}`))
        const photoBuf = await fetchImg((photoUrls as any)[a.id] || '')
        if (photoBuf) {
          children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [HALF, HALF], rows: [photoRow(photoBuf)] }))
        }
        children.push(compGrid([
          ['Building Size', a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—'],
          ['Lot Size', a.lot_size_ac ? `${a.lot_size_ac} AC` : '—'],
          ['Office SF', a.office_sf ? `${Number(a.office_sf).toLocaleString()} SF` : '—'],
          ['Ceiling Height', a.ceiling_height ? `${a.ceiling_height} ft` : '—'],
          ['Loading Docks', str(a.loading_docks)],
          ['Drive-Ins', str(a.drive_ins)],
          ['Power', str(a.power)],
          ['Heat', str(a.heat)],
          ['Sprinklers', str(a.sprinkler)],
          ['Parking', str(a.parking)],
          ['Sewer', str(a.sewer)],
          ['Zoning', str(a.zoning)],
          ['RE Taxes', a.re_taxes ? `$${Number(a.re_taxes).toLocaleString()}/yr` : '—'],
          ['Asking Rent', a.asking_rent ? `$${Number(a.asking_rent).toFixed(2)}/SF/yr${a.rent_type ? ' — ' + a.rent_type : ''}` : '—'],
          ['Landlord', str(a.landlord)],
          ['Property Type', str(a.property_type)],
        ]))
        if (a.notes) children.push(spacer(), para([run('Notes:  ', { bold: true, size: 17 }), run(a.notes, { size: 17, italic: true })], { before: 40, after: 40 }))
        children.push(spacer())
      }
    }

    // ── SECTION V: SALE COMPS ──────────────────────────────────────────────
    if (comps.length > 0) {
      const secNum = (isLease || (leaseComps.length > 0 && includeLeaseComps)) ? 'V' : 'IV'
      children.push(sectionTitle(`SECTION ${secNum} — SALE COMPARABLES`))
      children.push(summaryTable(
        ['Property Address', 'City', 'Building SF', 'Sale Price', '$/SF', 'Date'],
        comps.map((c: any) => {
          const psf = c.price_per_sf || (c.sale_price && c.building_sf ? Number(c.sale_price) / Number(c.building_sf) : 0)
          return [c.address || '—', c.city || '—', c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—', fmtDollar(c.sale_price), psf ? `$${Number(psf).toFixed(2)}` : '—', fmtDate(c.sale_date)]
        })
      ))
      children.push(spacer())
      for (let i = 0; i < comps.length; i++) {
        const c = comps[i]
        const psf = c.price_per_sf || (c.sale_price && c.building_sf ? Number(c.sale_price) / Number(c.building_sf) : 0)
        children.push(compTitle(`Sale Comparable #${i + 1} — ${c.address || ''}${c.city ? ', ' + c.city : ''}`))
        const photoBuf = await fetchImg((photoUrls as any)[c.id] || '')
        if (photoBuf) {
          children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [HALF, HALF], rows: [photoRow(photoBuf)] }))
        }
        children.push(compGrid([
          ['Building Size', c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—'],
          ['Lot Size', c.lot_size_ac ? `${c.lot_size_ac} AC` : '—'],
          ['Ceiling Height', c.ceiling_height ? `${c.ceiling_height} ft` : '—'],
          ['Loading Docks', str(c.loading_docks)],
          ['Drive-Ins', str(c.drive_ins)],
          ['Power', str(c.power)],
          ['Heat', str(c.heat)],
          ['Sprinklers', str(c.sprinkler)],
          ['Parking', str(c.parking)],
          ['Sewer', str(c.sewer)],
          ['Zoning', str(c.zoning)],
          ['RE Taxes', c.real_estate_taxes ? `$${Number(c.real_estate_taxes).toLocaleString()}/yr` : '—'],
          ['Sale Price', fmtDollar(c.sale_price)],
          ['Sale Price PSF', psf ? `$${Number(psf).toFixed(2)}/SF` : '—'],
          ['Buyer', str(c.buyer)],
          ['Seller', str(c.seller)],
          ['Sale Date', fmtDate(c.sale_date)],
          ['Property Type', str(c.property_type)],
        ]))
        if (c.notes) children.push(spacer(), para([run('Notes:  ', { bold: true, size: 17 }), run(c.notes, { size: 17, italic: true })], { before: 40, after: 40 }))
        children.push(spacer())
      }
    }

    // ── MARKET SALE AVAILABILITIES ─────────────────────────────────────────
    if (avails.length > 0 && !isLease && includeAvails) {
      children.push(subTitle('Market Sale Availabilities'))
      children.push(summaryTable(
        ['Property Address', 'City', 'Building SF', 'Asking Price', '$/SF'],
        avails.map((a: any) => {
          const psf = a.price_per_sf || (a.asking_price && a.building_sf ? Number(a.asking_price) / Number(a.building_sf) : 0)
          return [a.address || '—', a.city || '—', a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—', fmtDollar(a.asking_price), psf ? `$${Number(psf).toFixed(2)}` : '—']
        })
      ))
      children.push(spacer())
      for (let i = 0; i < avails.length; i++) {
        const a = avails[i]
        const psf = a.price_per_sf || (a.asking_price && a.building_sf ? Number(a.asking_price) / Number(a.building_sf) : 0)
        children.push(compTitle(`Availability #${i + 1} — ${a.address || ''}${a.city ? ', ' + a.city : ''}`))
        const photoBuf = await fetchImg((photoUrls as any)[a.id] || '')
        if (photoBuf) {
          children.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [HALF, HALF], rows: [photoRow(photoBuf)] }))
        }
        children.push(compGrid([
          ['Building Size', a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—'],
          ['Lot Size', a.lot_size_ac ? `${a.lot_size_ac} AC` : '—'],
          ['Ceiling Height', a.ceiling_height ? `${a.ceiling_height} ft` : '—'],
          ['Loading Docks', str(a.loading_docks)],
          ['Drive-Ins', str(a.drive_ins)],
          ['Power', str(a.power)],
          ['Heat', str(a.heat)],
          ['Sprinklers', str(a.sprinkler)],
          ['Parking', str(a.parking)],
          ['Sewer', str(a.sewer)],
          ['Zoning', str(a.zoning)],
          ['RE Taxes', a.real_estate_taxes ? `$${Number(a.real_estate_taxes).toLocaleString()}/yr` : '—'],
          ['Asking Price', fmtDollar(a.asking_price)],
          ['Price PSF', psf ? `$${Number(psf).toFixed(2)}/SF` : '—'],
          ...(a.pricing_guidance ? [['Pricing Guidance', str(a.pricing_guidance)] as [string,string]] : []),
          ['Landlord', str(a.landlord)],
        ]))
        if (a.notes) children.push(spacer(), para([run('Notes:  ', { bold: true, size: 17 }), run(a.notes, { size: 17, italic: true })], { before: 40, after: 40 }))
        children.push(spacer())
      }
    }

    // ── MARKETING STRATEGY ─────────────────────────────────────────────────
    if (includeMarketingStrategy && aiText && aiText.trim().length > 20) {
      children.push(sectionTitle('SECTION VI — MARKETING STRATEGY'))
      aiText.split('\n').filter(Boolean).forEach((line: string) => {
        const t = line.trim()
        if (t.toUpperCase() === t && t.length > 3) children.push(subTitle(t))
        else children.push(para([run(t, { size: 18 })], { before: 0, after: 80 }))
      })
    }

    // ── BUILD DOCUMENT ─────────────────────────────────────────────────────
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 },
          },
        },
        children,
      }],
    })

    const buffer = await Packer.toBuffer(doc)
    const filename = subject.address
      ? `OPV_${subject.address.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}.docx`
      : 'OPV_Report.docx'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    console.error('generate-docx error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
