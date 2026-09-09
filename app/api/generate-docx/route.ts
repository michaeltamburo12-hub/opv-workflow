export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  AlignmentType, WidthType, ShadingType, BorderStyle, PageBreak,
  HeadingLevel, UnderlineType,
} from 'docx'

// ── Helpers ────────────────────────────────────────────────────────────────

const NAVY   = '1C3557'
const GOLD   = 'B8860B'
const LGRAY  = 'F2F2F2'
const WHITE  = 'FFFFFF'
const W      = 9360  // content width in DXA (US Letter minus 1" margins each side)
const L_COL  = 2700  // label column width
const V_COL  = W - L_COL  // value column width

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }

const fmtNum  = (v: any) => v ? Number(v).toLocaleString() : '—'
const fmtDollar = (v: any) => v ? `$${Number(v).toLocaleString()}` : '—'
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'
const str     = (v: any) => (v != null && v !== '') ? String(v) : '—'

function run(text: string, opts: { bold?: boolean; size?: number; color?: string; allCaps?: boolean; italic?: boolean } = {}) {
  return new TextRun({ text, font: 'Arial', size: opts.size ?? 18, bold: opts.bold, color: opts.color, allCaps: opts.allCaps, italics: opts.italic })
}

function para(children: TextRun[], opts: { spacing?: { before?: number; after?: number }; alignment?: AlignmentType } = {}) {
  return new Paragraph({ children, spacing: { before: opts.spacing?.before ?? 0, after: opts.spacing?.after ?? 60 }, alignment: opts.alignment })
}

function cell(text: string, opts: { shade?: boolean; bold?: boolean; width?: number; color?: string; size?: number; header?: boolean } = {}) {
  const fill = opts.header ? NAVY : (opts.shade ? LGRAY : WHITE)
  const textColor = opts.header ? 'FFFFFF' : (opts.color ?? '111111')
  return new TableCell({
    width: { size: opts.width ?? V_COL, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill },
    borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
    children: [new Paragraph({
      children: [run(text || '—', { bold: opts.bold ?? opts.header, size: opts.size ?? 18, color: textColor })],
      spacing: { before: 40, after: 40 },
    })],
  })
}

function labelRow(label: string, value: string, shade = false) {
  return new TableRow({ children: [
    cell(label, { width: L_COL, bold: true, shade, color: '444444' }),
    cell(value,  { width: V_COL, shade }),
  ]})
}

function propTable(rows: [string, string, boolean?][]) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    rows: rows.map(([l, v, s]) => labelRow(l, v, !!s)),
  })
}

function sectionHeading(num: string, title: string) {
  return new Paragraph({
    children: [run(num ? `${num}.  ${title}` : title, { bold: true, size: 24, color: NAVY, allCaps: true })],
    spacing: { before: 340, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY } },
  })
}

function cardHeader(text: string, rightText = '') {
  const children: TextRun[] = [run(text, { bold: true, size: 20, color: NAVY, allCaps: true })]
  if (rightText) {
    children.push(run('    ' + rightText, { bold: true, size: 20, color: GOLD }))
  }
  return new Paragraph({
    children,
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD } },
  })
}

function bulletPara(text: string) {
  return new Paragraph({
    children: [run('• ' + text, { size: 18 })],
    spacing: { before: 60, after: 60 },
    indent: { left: 360 },
  })
}

function spacer() {
  return new Paragraph({ children: [], spacing: { before: 0, after: 120 } })
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } })
}

// Summary table rows for comps (multi-column)
function summaryRow(cells: string[], shade = false) {
  const colW = Math.floor(W / cells.length)
  return new TableRow({
    children: cells.map((t, i) => new TableCell({
      width: { size: i === cells.length - 1 ? W - colW * (cells.length - 1) : colW, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: shade ? LGRAY : WHITE },
      borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      children: [new Paragraph({ children: [run(t || '—', { size: 17 })], spacing: { before: 40, after: 40 } })],
    })),
  })
}

function headerRow(headers: string[]) {
  const colW = Math.floor(W / headers.length)
  return new TableRow({
    tableHeader: true,
    children: headers.map((t, i) => new TableCell({
      width: { size: i === headers.length - 1 ? W - colW * (headers.length - 1) : colW, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: NAVY },
      borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      children: [new Paragraph({ children: [run(t, { bold: true, size: 17, color: 'FFFFFF' })], spacing: { before: 40, after: 40 } })],
    })),
  })
}

function summaryTable(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    rows: [
      headerRow(headers),
      ...rows.map((r, i) => summaryRow(r, i % 2 === 1)),
    ],
  })
}

// ── Main Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { subject, comps, leaseComps, leaseAvails, avails, analytics, aiText, includeLeaseComps, includeAvails, includeMarketingStrategy } = await req.json()

    if (!subject) return NextResponse.json({ error: 'No subject data' }, { status: 400 })

    const isLease = subject.opvType === 'lease'
    const date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()

    const children: (Paragraph | Table)[] = []

    // ── COVER PAGE ──────────────────────────────────────────────────────────
    children.push(
      spacer(), spacer(),
      para([run('PREMIER COMMERCIAL REAL ESTATE', { bold: true, size: 32, color: NAVY, allCaps: true })], { spacing: { after: 80 } }),
      para([run('OPINION OF VALUE', { bold: true, size: 26, color: GOLD, allCaps: true })], { spacing: { after: 160 } }),
      para([run('Date Prepared', { bold: true, size: 20, color: '444444' })], { spacing: { after: 40 } }),
      para([run(date, { bold: true, size: 22, color: NAVY })], { spacing: { after: 160 } }),
      para([run('Property Address', { bold: true, size: 20, color: '444444' })], { spacing: { after: 40 } }),
      para([run(subject.address || '—', { bold: true, size: 22, color: NAVY })], { spacing: { after: 40 } }),
      ...(subject.city ? [para([run(`${subject.city.toUpperCase()}, NEW YORK`, { bold: true, size: 22, color: NAVY })], { spacing: { after: 160 } })] : []),
      spacer(),
      para([run('Prepared By:', { bold: true, size: 20, color: '444444' })], { spacing: { after: 40 } }),
      para([run(subject.preparedBy || 'Premier Commercial Real Estate', { size: 20 })], { spacing: { after: 40 } }),
      para([run('500 N. Broadway, Suite 105, Jericho, NY 11753', { size: 18, color: '666666' })], { spacing: { after: 40 } }),
      para([run('Main: 516.284.8000  |  www.pcrellc.com', { size: 18, color: '666666' })], { spacing: { after: 0 } }),
      pageBreak(),
    )

    // ── SECTION I: EXECUTIVE SUMMARY ────────────────────────────────────────
    children.push(sectionHeading('I', 'EXECUTIVE SUMMARY'), spacer())
    children.push(propTable([
      ['ADDRESS:', `${subject.address}${subject.city ? ', ' + subject.city.toUpperCase() + ', NEW YORK' : ''}`.toUpperCase(), false],
      ['COUNTY:', (subject.county || '—').toUpperCase(), true],
      ...(subject.municipality ? [['MUNICIPALITY:', subject.municipality, false] as [string,string,boolean?]] : []),
      ...(subject.parcelId    ? [['PARCEL ID:',    subject.parcelId,    true]  as [string,string,boolean?]] : []),
    ]))

    children.push(spacer())
    const highlights = [
      subject.size     ? `The building is approximately ${Number(subject.size).toLocaleString()} sq. ft. in total.` : null,
      subject.ceiling  ? `Ceiling height of ${subject.ceiling}' clear.` : null,
      (subject.docks||subject.driveIn) ? `${subject.docks||'—'} loading dock(s) and ${subject.driveIn||'—'} drive-in door(s).` : null,
      subject.sprinkler? `${subject.sprinkler} sprinkler system.` : null,
      subject.sewer    ? `Sewer: ${subject.sewer}.` : null,
      subject.power    ? `Electrical service: ${subject.power}.` : null,
      subject.taxes    ? `Real Estate Taxes are $${Number(subject.taxes).toLocaleString()}${subject.size ? ` or approximately $${(Number(subject.taxes)/Number(subject.size)).toFixed(2)} PSF` : ''}.` : null,
      subject.lot      ? `The building sits on a parcel of approximately ${subject.lot} acres.` : null,
      subject.notes    || null,
    ].filter(Boolean) as string[]

    children.push(para([run('PROPERTY SUMMARY HIGHLIGHTS AND ASSUMPTIONS:', { bold: true, size: 18, color: NAVY })], { spacing: { before: 120, after: 80 } }))
    highlights.forEach(h => children.push(bulletPara(h)))

    children.push(para([run('HIGHEST AND BEST USE:', { bold: true, size: 18, color: NAVY })], { spacing: { before: 120, after: 80 } }))
    const hbu = subject.highestBestUse
      ? subject.highestBestUse.split('\n').filter(Boolean)
      : ['Manufacturing', 'Wholesale Operation', 'Warehouse / Distribution']
    hbu.forEach((u: string) => children.push(bulletPara(u.trim())))

    // ── SECTION II: BUILDING DESCRIPTION ────────────────────────────────────
    children.push(sectionHeading('II', 'BUILDING DESCRIPTION'), spacer())
    const bldgRows: [string, string, boolean?][] = [
      ['PROPERTY ADDRESS', `${subject.address}${subject.city ? ', ' + subject.city : ''}`, false],
      ['TOTAL BUILDING SF', subject.size ? `${Number(subject.size).toLocaleString()} SF` : '—', true],
      ...(subject.officePct ? [['OFFICE', `${subject.officePct}%`, false] as [string,string,boolean?]] : []),
      ['TOTAL SITE ACREAGE', subject.lot ? `${subject.lot} AC` : '—', true],
      ['CEILING HEIGHT', subject.ceiling ? `${subject.ceiling}' clear` : '—', false],
      ['DRIVE-IN DOORS', subject.driveIn || '—', true],
      ['LOADING DOCKS', subject.docks || '—', false],
      ['HEAT', subject.heat || '—', true],
      ['POWER', subject.power || '—', false],
      ['PARKING', subject.parking || '—', true],
      ['SPRINKLER SYSTEM', subject.sprinkler || '—', false],
      ['SEWER CONNECTION', subject.sewer || '—', true],
      ['ZONING', subject.zoning || '—', false],
      ['REAL ESTATE TAXES', subject.taxes ? `$${Number(subject.taxes).toLocaleString()}/yr${subject.size ? ` / $${(Number(subject.taxes)/Number(subject.size)).toFixed(2)} PSF` : ''}` : '—', true],
      ...(subject.yearBuilt    ? [['YEAR BUILT',    subject.yearBuilt,    false] as [string,string,boolean?]] : []),
      ...(subject.construction ? [['CONSTRUCTION',  subject.construction, true]  as [string,string,boolean?]] : []),
      ...(subject.condition    ? [['CONDITION',     subject.condition,    false]  as [string,string,boolean?]] : []),
    ]
    children.push(propTable(bldgRows))

    // ── SECTION III: OPINION OF VALUE ───────────────────────────────────────
    children.push(sectionHeading('III', 'OPINION OF VALUE'), spacer())
    if (isLease) {
      const rentLow  = subject.leasePsfLow  || analytics?.leaseLow
      const rentHigh = subject.leasePsfHigh || analytics?.leaseHigh
      children.push(propTable([
        ['ESTIMATED VALUE FOR LEASE', rentLow && rentHigh ? `$${rentLow} – $${rentHigh} per SF per year — NNN` : '—', false],
        ['RECOMMENDED ASKING LEASE PRICE', analytics?.leaseSuggested ? `$${Number(analytics.leaseSuggested).toFixed(2)} per SF per year — NNN` : rentHigh ? `$${rentHigh} per SF per year — NNN` : '—', true],
      ]))
    } else {
      const valLow  = subject.estimatedValueLow
      const valHigh = subject.estimatedValueHigh
      children.push(propTable([
        ['ESTIMATED VALUE', valLow && valHigh ? `$${Number(valLow).toLocaleString()} – $${Number(valHigh).toLocaleString()}` : '—', false],
        ['RECOMMENDED ASKING PRICE', analytics?.suggestedAskingPrice ? `$${Number(analytics.suggestedAskingPrice).toLocaleString()}` : valHigh ? `$${Number(valHigh).toLocaleString()}` : '—', true],
      ]))
    }

    // ── SECTION IV: SALE COMPS (sale OPV) / LEASE COMPS (lease OPV) ────────
    if (isLease && leaseComps?.length > 0) {
      children.push(sectionHeading('IV', 'RECENT LEASE TRANSACTIONS'), spacer())
      children.push(summaryTable(
        ['Property Address', 'Town', 'Building SF', 'Deal Rent (PSF)', 'Rent Type', 'Term'],
        leaseComps.map((c: any) => [
          c.address || '—',
          c.town || '—',
          c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—',
          c.deal_rent ? `$${Number(c.deal_rent).toFixed(2)}/SF/yr` : c.asking_rent ? `$${Number(c.asking_rent).toFixed(2)}/SF/yr (Ask)` : '—',
          c.rent_type || '—',
          c.lease_term_years ? `${c.lease_term_years} yrs` : '—',
        ])
      ))
      leaseComps.forEach((c: any, i: number) => {
        children.push(spacer(), cardHeader(`LEASE COMPARABLE ${i + 1}  —  ${(c.address || '').toUpperCase()}${c.town ? ', ' + c.town.toUpperCase() : ''}`, c.deal_rent ? `$${Number(c.deal_rent).toFixed(2)}/SF/yr` : ''))
        const rows: [string, string, boolean?][] = [
          ['PROPERTY ADDRESS', `${c.address || '—'}${c.town ? ', ' + c.town : ''}`, false],
          ...(c.property_type ? [['PROPERTY TYPE', str(c.property_type), true] as [string,string,boolean?]] : []),
          ['BUILDING SIZE', c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—', false],
          ['LOT SIZE', c.lot_size_ac ? `${c.lot_size_ac} Acres` : '—', true],
          ...(c.office_sf ? [['OFFICE SIZE', `${Number(c.office_sf).toLocaleString()} SF`, false] as [string,string,boolean?]] : []),
          ['LOADING', c.loading_docks && c.drive_ins ? `${c.loading_docks} Docks / ${c.drive_ins} Drive-In` : c.loading_docks ? `${c.loading_docks} Docks` : c.drive_ins ? `${c.drive_ins} Drive-In` : '—', true],
          ['CEILING HEIGHT', c.ceiling_height ? `${c.ceiling_height} ft` : '—', false],
          ['POWER', str(c.power), true],
          ['HEAT', str(c.heat), false],
          ['SPRINKLERS', str(c.sprinkler), true],
          ['PARKING', str(c.parking), false],
          ['SEWER', str(c.sewer), true],
          ['ZONING', str(c.zoning), false],
          ...(c.re_taxes ? [['RE TAXES', `$${Number(c.re_taxes).toLocaleString()}/yr`, true] as [string,string,boolean?]] : []),
          ['LEASE PRICE', c.deal_rent ? `$${Number(c.deal_rent).toFixed(2)} PSF/yr${c.rent_type ? ' — ' + c.rent_type : ''}` : c.asking_rent ? `$${Number(c.asking_rent).toFixed(2)} PSF/yr (Ask)` : '—', false],
          ['TAXES ($/SF)', c.taxes ? `$${Number(c.taxes).toFixed(2)}/SF` : '—', true],
          ['LEASE TERM', c.lease_term_years ? `${c.lease_term_years} years` : '—', false],
          ['ESCALATIONS', str(c.escalations), true],
          ...(c.rent_concession_months ? [['CONCESSION', `${c.rent_concession_months} months`, false] as [string,string,boolean?]] : []),
          ...(c.ti_ll_work ? [['LANDLORD WORK', str(c.ti_ll_work), true] as [string,string,boolean?]] : []),
          ['TENANT NAME', str(c.tenant), false],
          ['LANDLORD NAME', str(c.landlord), true],
          ['TRANSACTION DATE', fmtDate(c.transaction_date), false],
          ...(c.notes ? [['NOTES', str(c.notes), true] as [string,string,boolean?]] : []),
        ]
        children.push(propTable(rows))
      })
    } else if (!isLease && comps?.length > 0) {
      children.push(sectionHeading('IV', 'SALE COMPARABLES'), spacer())
      children.push(summaryTable(
        ['Property Address', 'City', 'Building SF', 'Sale Price', '$/SF', 'Date'],
        comps.map((c: any) => {
          const psf = c.price_per_sf || (c.sale_price && c.building_sf ? Number(c.sale_price) / Number(c.building_sf) : 0)
          return [c.address || '—', c.city || '—', c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—', fmtDollar(c.sale_price), psf ? `$${Number(psf).toFixed(2)}` : '—', fmtDate(c.sale_date)]
        })
      ))
      comps.forEach((c: any, i: number) => {
        const psf = c.price_per_sf || (c.sale_price && c.building_sf ? Number(c.sale_price) / Number(c.building_sf) : 0)
        children.push(spacer(), cardHeader(`SALE COMPARABLE ${i + 1}  —  ${(c.address || '').toUpperCase()}${c.city ? ', ' + c.city.toUpperCase() : ''}`, psf ? `$${Number(psf).toFixed(2)}/SF` : ''))
        const rows: [string, string, boolean?][] = [
          ['PROPERTY ADDRESS', `${c.address || '—'}${c.city ? ', ' + c.city : ''}`, false],
          ...(c.property_type ? [['PROPERTY TYPE', str(c.property_type), true] as [string,string,boolean?]] : []),
          ['BUILDING SIZE', c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—', false],
          ...(c.lot_size_ac ? [['LOT SIZE', `${c.lot_size_ac} Acres`, true] as [string,string,boolean?]] : []),
          ['CEILING HEIGHT', c.ceiling_height ? `${c.ceiling_height} ft` : '—', false],
          ['LOADING DOCKS', str(c.loading_docks), true],
          ['DRIVE INS', str(c.drive_ins), false],
          ['POWER', str(c.power), true],
          ['HEAT', str(c.heat), false],
          ['SPRINKLERS', str(c.sprinkler), true],
          ['PARKING', str(c.parking), false],
          ['SEWER', str(c.sewer), true],
          ['ZONING', str(c.zoning), false],
          ...(c.real_estate_taxes ? [['RE TAXES', `$${Number(c.real_estate_taxes).toLocaleString()}/yr`, true] as [string,string,boolean?]] : []),
          ['SALE PRICE', fmtDollar(c.sale_price) + (psf ? ` ($${Number(psf).toFixed(2)} PSF)` : ''), false],
          ['TRANSACTION DATE', fmtDate(c.sale_date), true],
          ['BUYER', str(c.buyer), false],
          ['SELLER', str(c.seller), true],
          ...(c.notes ? [['NOTES', str(c.notes), false] as [string,string,boolean?]] : []),
        ]
        children.push(propTable(rows))
      })
    }

    // ── SECTION V: Lease Comps in Sale OPV / Sale Data in Lease OPV ─────────
    if (!isLease && includeLeaseComps && leaseComps?.length > 0) {
      children.push(sectionHeading('V', 'RECENT LEASE TRANSACTIONS'), spacer())
      children.push(summaryTable(
        ['Property Address', 'Town', 'Building SF', 'Deal Rent (PSF)', 'Rent Type', 'Term'],
        leaseComps.map((c: any) => [
          c.address || '—', c.town || '—',
          c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—',
          c.deal_rent ? `$${Number(c.deal_rent).toFixed(2)}/SF/yr` : c.asking_rent ? `$${Number(c.asking_rent).toFixed(2)} (Ask)` : '—',
          c.rent_type || '—', c.lease_term_years ? `${c.lease_term_years} yrs` : '—',
        ])
      ))
      leaseComps.forEach((c: any, i: number) => {
        children.push(spacer(), cardHeader(`LEASE COMPARABLE ${i + 1}  —  ${(c.address || '').toUpperCase()}${c.town ? ', ' + c.town.toUpperCase() : ''}`))
        const rows: [string, string, boolean?][] = [
          ['PROPERTY ADDRESS', `${c.address || '—'}${c.town ? ', ' + c.town : ''}`, false],
          ...(c.property_type ? [['PROPERTY TYPE', str(c.property_type), true] as [string,string,boolean?]] : []),
          ['BUILDING SIZE', c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—', false],
          ['CEILING HEIGHT', c.ceiling_height ? `${c.ceiling_height} ft` : '—', true],
          ['LOADING DOCKS', str(c.loading_docks), false],
          ['DRIVE-INS', str(c.drive_ins), true],
          ['POWER', str(c.power), false],
          ['HEAT', str(c.heat), true],
          ['SPRINKLERS', str(c.sprinkler), false],
          ['PARKING', str(c.parking), true],
          ['SEWER', str(c.sewer), false],
          ['ZONING', str(c.zoning), true],
          ...(c.re_taxes ? [['RE TAXES', `$${Number(c.re_taxes).toLocaleString()}/yr`, false] as [string,string,boolean?]] : []),
          ['ASKING RENT', c.asking_rent ? `$${Number(c.asking_rent).toFixed(2)} PSF/yr` : '—', true],
          ['DEAL RENT', c.deal_rent ? `$${Number(c.deal_rent).toFixed(2)} PSF/yr` : '—', false],
          ...(c.rent_type ? [['RENT TYPE', str(c.rent_type), true] as [string,string,boolean?]] : []),
          ...(c.taxes ? [['TAXES ($/SF)', `$${Number(c.taxes).toFixed(2)}/SF`, false] as [string,string,boolean?]] : []),
          ...(c.lease_term_years ? [['LEASE TERM', `${c.lease_term_years} years`, true] as [string,string,boolean?]] : []),
          ...(c.tenant ? [['TENANT', str(c.tenant), false] as [string,string,boolean?]] : []),
          ...(c.landlord ? [['LANDLORD', str(c.landlord), true] as [string,string,boolean?]] : []),
          ...(c.notes ? [['NOTES', str(c.notes), false] as [string,string,boolean?]] : []),
        ]
        children.push(propTable(rows))
      })
    }

    // ── SECTION VI: MARKET AVAILABILITIES ────────────────────────────────────
    const availList = isLease ? (leaseAvails || []) : (avails || [])
    if (includeAvails && availList.length > 0) {
      const sectionNum = (!isLease && includeLeaseComps && leaseComps?.length > 0) ? 'VI' : 'V'
      children.push(sectionHeading(sectionNum, isLease ? 'LEASE MARKET AVAILABILITIES' : 'MARKET AVAILABILITIES'), spacer())

      if (isLease) {
        children.push(summaryTable(
          ['Property Address', 'Town', 'Building SF', 'Asking Rent', 'Rent Type'],
          availList.map((a: any) => [a.address || '—', a.town || '—', a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—', a.asking_rent ? `$${Number(a.asking_rent).toFixed(2)}/SF/yr` : '—', a.rent_type || '—'])
        ))
        availList.forEach((a: any, i: number) => {
          children.push(spacer(), cardHeader(`AVAILABILITY ${i + 1}  —  ${(a.address || '').toUpperCase()}${a.town ? ', ' + a.town.toUpperCase() : ''}`, a.asking_rent ? `$${Number(a.asking_rent).toFixed(2)}/SF/yr` : ''))
          const rows: [string, string, boolean?][] = [
            ['PROPERTY ADDRESS', `${a.address || '—'}${a.town ? ', ' + a.town : ''}`, false],
            ...(a.property_type ? [['PROPERTY TYPE', str(a.property_type), true] as [string,string,boolean?]] : []),
            ['BUILDING SIZE', a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—', false],
            ['LOT SIZE', a.lot_size_ac ? `${a.lot_size_ac} Acres` : '—', true],
            ['CEILING HEIGHT', a.ceiling_height ? `${a.ceiling_height} ft` : '—', false],
            ['LOADING DOCKS', str(a.loading_docks), true],
            ['DRIVE-INS', str(a.drive_ins), false],
            ['POWER', str(a.power), true],
            ['HEAT', str(a.heat), false],
            ['SPRINKLERS', str(a.sprinkler), true],
            ['PARKING', str(a.parking), false],
            ['SEWER', str(a.sewer), true],
            ['ZONING', str(a.zoning), false],
            ...(a.re_taxes ? [['RE TAXES', `$${Number(a.re_taxes).toLocaleString()}/yr`, true] as [string,string,boolean?]] : []),
            ['ASKING RENT', a.asking_rent ? `$${Number(a.asking_rent).toFixed(2)}/SF/yr` : '—', false],
            ['RENT TYPE', str(a.rent_type), true],
            ['LANDLORD', str(a.landlord), false],
            ...(a.notes ? [['NOTES', str(a.notes), true] as [string,string,boolean?]] : []),
          ]
          children.push(propTable(rows))
        })
      } else {
        children.push(summaryTable(
          ['Property Address', 'City', 'Building SF', 'Asking Price', '$/SF'],
          availList.map((a: any) => {
            const psf = a.price_per_sf || (a.asking_price && a.building_sf ? Number(a.asking_price) / Number(a.building_sf) : 0)
            return [a.address || '—', a.city || '—', a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—', fmtDollar(a.asking_price), psf ? `$${Number(psf).toFixed(2)}` : '—']
          })
        ))
        availList.forEach((a: any, i: number) => {
          const psf = a.price_per_sf || (a.asking_price && a.building_sf ? Number(a.asking_price) / Number(a.building_sf) : 0)
          children.push(spacer(), cardHeader(`AVAILABILITY ${i + 1}  —  ${(a.address || '').toUpperCase()}${a.city ? ', ' + a.city.toUpperCase() : ''}`, psf ? `$${Number(psf).toFixed(2)}/SF` : ''))
          const rows: [string, string, boolean?][] = [
            ['PROPERTY ADDRESS', `${a.address || '—'}${a.city ? ', ' + a.city : ''}`, false],
            ...(a.property_type ? [['PROPERTY TYPE', str(a.property_type), true] as [string,string,boolean?]] : []),
            ['BUILDING SIZE', a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—', false],
            ['LOT SIZE', a.lot_size_ac ? `${a.lot_size_ac} Acres` : '—', true],
            ['CEILING HEIGHT', a.ceiling_height ? `${a.ceiling_height} ft` : '—', false],
            ['LOADING DOCKS', str(a.loading_docks), true],
            ['DRIVE INS', str(a.drive_ins), false],
            ['POWER', str(a.power), true],
            ['HEAT', str(a.heat), false],
            ['SEWER', str(a.sewer), true],
            ['ZONING', str(a.zoning), false],
            ['SPRINKLERS', str(a.sprinkler), true],
            ['PARKING', str(a.parking), false],
            ...(a.real_estate_taxes ? [['RE TAXES', `$${Number(a.real_estate_taxes).toLocaleString()}/yr`, true] as [string,string,boolean?]] : []),
            ['ASKING PRICE', fmtDollar(a.asking_price) + (psf ? ` ($${Number(psf).toFixed(2)} PSF)` : ''), false],
            ...(a.pricing_guidance ? [['PRICING GUIDANCE', str(a.pricing_guidance), true] as [string,string,boolean?]] : []),
            ...(a.notes ? [['NOTES', str(a.notes), false] as [string,string,boolean?]] : []),
          ]
          children.push(propTable(rows))
        })
      }
    }

    // ── AI TEXT / MARKET COMMENTARY ──────────────────────────────────────────
    if (aiText && aiText.trim().length > 50) {
      children.push(sectionHeading('', 'MARKET COMMENTARY & BROKER ANALYSIS'), spacer())
      aiText.split('\n').filter(Boolean).forEach((line: string) => {
        children.push(para([run(line.trim(), { size: 18 })], { spacing: { after: 100 } }))
      })
    }

    // ── BUILD DOCUMENT ────────────────────────────────────────────────────────
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
