export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, TabStopType, TabStopPosition,
  LevelFormat, PageBreak
} from 'docx'
import fs from 'fs'
import path from 'path'

// ── COLORS ────────────────────────────────────────────────────────────────────
const GOLD        = 'C9A227'
const DARK        = '1A1A1A'
const GRAY_HDR    = '2D2D2D'
const LIGHT_GRAY  = 'F2F2F2'
const MID_GRAY    = 'EBEBEB'
const WHITE       = 'FFFFFF'
const BORDER_CLR  = 'CCCCCC'

// ── BORDERS ───────────────────────────────────────────────────────────────────
const b1  = { style: BorderStyle.SINGLE, size: 1, color: BORDER_CLR }
const bAll  = { top: b1, bottom: b1, left: b1, right: b1 }
const bNone = {
  top:    { style: BorderStyle.NONE, size: 0, color: WHITE },
  bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
  left:   { style: BorderStyle.NONE, size: 0, color: WHITE },
  right:  { style: BorderStyle.NONE, size: 0, color: WHITE },
}

// ── FORMATTERS ────────────────────────────────────────────────────────────────
const fmt = (n: number | string | null | undefined, pre = '', suf = '') =>
  n ? `${pre}${Number(n).toLocaleString()}${suf}` : '—'

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) } catch { return d }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any

function spacer(before = 80, after = 80): AnyEl {
  return new Paragraph({ children: [new TextRun('')], spacing: { before, after } })
}

function goldRule(space = 4): AnyEl {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space } },
    spacing: { before: 0, after: 0 },
  })
}

function thinRule(): AnyEl {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_CLR, space: 4 } },
    spacing: { before: 0, after: 0 },
  })
}

function sectionHeading(num: string, title: string): AnyEl {
  return new Paragraph({
    children: [
      new TextRun({ text: `${num}.    `, bold: true, size: 26, font: 'Arial', color: GOLD }),
      new TextRun({ text: title, bold: true, size: 26, font: 'Arial', color: DARK }),
    ],
    spacing: { before: 300, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 4 } },
  })
}

function subHeading(text: string): AnyEl {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color: DARK })],
    spacing: { before: 240, after: 100 },
  })
}

function bodyText(text: string, opts: { italic?: boolean; bold?: boolean; color?: string; size?: number } = {}): AnyEl {
  return new Paragraph({
    children: [new TextRun({ text, size: opts.size || 20, font: 'Arial', italic: opts.italic, bold: opts.bold, color: opts.color || DARK })],
    spacing: { before: 60, after: 60 },
  })
}

function bullet(text: string): AnyEl {
  return new Paragraph({
    children: [
      new TextRun({ text: '→  ', size: 20, font: 'Arial', color: GOLD, bold: true }),
      new TextRun({ text, size: 20, font: 'Arial', color: DARK }),
    ],
    spacing: { before: 80, after: 40 },
    indent: { left: 360 },
  })
}

function labelRow(label: string, value: string, shade = false): AnyEl {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 3240, type: WidthType.DXA },
        borders: bAll,
        shading: { fill: MID_GRAY, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: 'Arial', color: DARK })] })],
      }),
      new TableCell({
        width: { size: 6120, type: WidthType.DXA },
        borders: bAll,
        shading: { fill: shade ? LIGHT_GRAY : WHITE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: 18, font: 'Arial', color: DARK })] })],
      }),
    ],
  })
}

function darkHeaderRow(labels: string[], widths: number[]): AnyEl {
  return new TableRow({
    tableHeader: true,
    children: labels.map((label, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        borders: bAll,
        shading: { fill: GRAY_HDR, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 80 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: label, bold: true, size: 17, font: 'Arial', color: WHITE })],
        })],
      })
    ),
  })
}

function dataRow(cells: string[], widths: number[], shade = false): AnyEl {
  return new TableRow({
    children: cells.map((cell, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        borders: bAll,
        shading: { fill: shade ? LIGHT_GRAY : WHITE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 80 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: cell || '—', size: 17, font: 'Arial', color: DARK })],
        })],
      })
    ),
  })
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}

// ── COMP DETAIL PAGE ──────────────────────────────────────────────────────────
function buildCompPage(c: Record<string, unknown>, idx: number, photo: Buffer | null, type: 'sale' | 'lease'): AnyEl[] {
  const photoEl: AnyEl = photo ? new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: 'jpg', data: photo, transformation: { width: 480, height: 260 } })],
    spacing: { before: 60, after: 160 },
  }) : spacer(40, 120)

  const title = type === 'sale'
    ? `COMPARABLE ${idx + 1}  —  ${((c.address as string) || '').toUpperCase()}`
    : `LEASE COMPARABLE ${idx + 1}  —  ${((c.address as string) || '').toUpperCase()}`

  const rows: AnyEl[] = type === 'sale' ? [
    labelRow('PROPERTY ADDRESS', `${c.address || '—'}${c.city ? ', ' + c.city : ''}`),
    labelRow('BUILDING SIZE', fmt(c.building_sf as number, '+/- ', ' SF')),
    ...(c.lot_size_ac ? [labelRow('LOT SIZE', fmt(c.lot_size_ac as number, '', ' Acres'), true)] : []),
    ...(c.office_pct ? [labelRow('OFFICE SQ. FT.', `${c.office_pct}%`)] : []),
    labelRow('DRIVE INS', (c.drive_ins as string) || '—', !!(c.lot_size_ac)),
    labelRow('LOADING DOCKS', (c.loading_docks as string) || '—', !(c.lot_size_ac)),
    labelRow('CEILING HEIGHT', (c.ceiling_height as string) || '—', !!(c.lot_size_ac)),
    ...(c.heat ? [labelRow('HEAT', c.heat as string, !(c.lot_size_ac))] : []),
    ...(c.power ? [labelRow('POWER', c.power as string, !!(c.lot_size_ac))] : []),
    ...(c.sewer ? [labelRow('SEWERS', c.sewer as string, !(c.lot_size_ac))] : []),
    ...(c.parking ? [labelRow('PARKING', c.parking as string, !!(c.lot_size_ac))] : []),
    labelRow('SALE PRICE', fmt(c.sale_price as number, '$') + (c.price_per_sf || (c.sale_price && c.building_sf) ? ` ($${(Number(c.price_per_sf) || Number(c.sale_price)/Number(c.building_sf)).toFixed(2)} PSF)` : '')),
    ...(c.lease_income ? [labelRow('LEASE INCOME', `$${Number(c.lease_income).toLocaleString()} NNN`, true)] : []),
    ...(c.real_estate_taxes ? [labelRow('REAL ESTATE TAXES', `($${Number(c.real_estate_taxes).toFixed(2)} PSF)`)] : []),
    ...(c.lease_term ? [labelRow('TERM', c.lease_term as string, true)] : []),
    ...(c.annual_escalations ? [labelRow('ANNUAL ESCALATIONS', c.annual_escalations as string)] : []),
    ...(c.cap_rate ? [labelRow('CAP RATE', `${c.cap_rate}%`, true)] : []),
    ...(c.transaction_date ? [labelRow('TRANSACTION DATE', c.transaction_date as string)] : [c.sale_date ? labelRow('TRANSACTION DATE', fmtDate(c.sale_date as string)) : null].filter(Boolean) as AnyEl[]),
    ...(c.buyer ? [labelRow('BUYER', c.buyer as string, true)] : []),
    ...(c.seller ? [labelRow('SELLER/TENANT', c.seller as string)] : []),
    ...(c.tenant ? [labelRow('TENANT', c.tenant as string, true)] : []),
    ...(c.comments ? [labelRow('COMMENTS', c.comments as string)] : []),
  ] : [
    labelRow('PROPERTY ADDRESS', `${c.address || '—'}${c.city ? ', ' + c.city : ''}`),
    labelRow('BUILDING SIZE', fmt(c.building_sf as number, '+/- ', ' SF')),
    ...(c.lot_size_ac ? [labelRow('PLOT', fmt(c.lot_size_ac as number, '', ' Acres'), true)] : []),
    ...(c.office_pct ? [labelRow('OFFICE', `${c.office_pct}%`)] : []),
    labelRow('DRIVE INS', (c.drive_ins as string) || '—', !c.office_pct),
    labelRow('LOADING DOCKS', (c.loading_docks as string) || '—', !!c.office_pct),
    labelRow('CEILING HEIGHT', (c.ceiling_height as string) || '—', !c.office_pct),
    labelRow('LEASE PRICE', (c.lease_price as string) || (c.price_per_sf ? `$${Number(c.price_per_sf).toFixed(2)} PSF NNN` : '—'), !!c.office_pct),
    labelRow('REAL ESTATE TAXES', (c.taxes_psf ? `$${Number(c.taxes_psf).toFixed(2)} PSF` : (c.real_estate_taxes as string) || '—'), !c.office_pct),
    ...(c.lease_term ? [labelRow('TERM', c.lease_term as string, !!c.office_pct)] : []),
    ...(c.annual_escalations ? [labelRow('ESCALATIONS', c.annual_escalations as string, !c.lease_term)] : []),
    ...(c.landlord_work ? [labelRow('LANDLORD WORK', c.landlord_work as string, !!c.annual_escalations)] : []),
    ...(c.transaction_date ? [labelRow('TRANSACTION DATE', c.transaction_date as string, !c.landlord_work)] : []),
    ...(c.tenant ? [labelRow('TENANT', c.tenant as string, !!c.transaction_date)] : []),
    ...(c.comments ? [labelRow('COMMENTS', c.comments as string, !c.tenant)] : []),
  ]

  return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 22, font: 'Arial', color: DARK })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 3 } },
      spacing: { after: 140 },
    }),
    photoEl,
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3240, 6120],
      rows,
    }),
    spacer(80, 40),
  ]
}

// ── PCRE COMPLETED SALES TABLE ────────────────────────────────────────────────
function buildRecentSalesTable(): AnyEl[] {
  const sales = [
    ['128 Spagnoli Rd', 'Melville', 'Redevelopment', '150,000', '$21,000,000', '3rd Quarter 2025'],
    ['48 Mall Dr', 'Commack', 'Industrial', '20,000', '$4,700,000', '2nd Quarter 2025'],
    ['22 Sutton Place', 'Brewster', 'Industrial', '70,000', 'Undisclosed', '1st Quarter 2025'],
    ['474 Grand Blvd', 'Westbury', 'Industrial', '71,000', '$14,250,000', '4th Quarter 2024'],
    ['145 Kennedy Dr', 'Hauppauge', 'Industrial', '40,000', '$8,150,000', '3rd Quarter 2024'],
    ['200 Central Ave', 'Farmingdale', 'Industrial', '25,000', '$5,875,000', '2nd Quarter 2024'],
    ['218 Front St', 'Hempstead', 'Industrial', '30,183', '$4,750,000', '1st Quarter 2024'],
    ['30 Eastern Ave', 'Deer Park', 'Industrial', '11,940', '$2,200,000', '1st Quarter 2024'],
    ['81 Modular Ave', 'Commack', 'Industrial', '30,000', '$6,150,000', '4th Quarter 2023'],
    ['19 Power Drive', 'Hauppauge', 'Industrial', '12,000', '$2,050,000', '4th Quarter 2023'],
    ['182 Bethpage-SH Rd', 'Old Bethpage', 'Industrial', '48,000', '$7,512,500', '4th Quarter 2022'],
    ['66-70 Austin Blvd', 'Commack', 'Industrial', '40,000', '$10,250,000', '3rd Quarter 2022'],
    ['40 Ranick Road', 'Hauppauge', 'Industrial', '35,760', '$8,400,000', '3rd Quarter 2022'],
    ['10 Ranick Dr S', 'Amityville', 'Industrial', '43,500', '$7,350,000', '3rd Quarter 2022'],
    ['5 Park Drive', 'Melville', 'Industrial', '50,000', '$14,500,000', '2nd Quarter 2022'],
    ['355 Crooked Hill Rd', 'Brentwood', 'Industrial', '83,000', '$18,150,000', '2nd Quarter 2022'],
    ['600 Prime Place', 'Hauppauge', 'Industrial', '45,000', '$8,300,000', '1st Quarter 2021'],
    ['555 Prime Place', 'Hauppauge', 'Industrial', '45,000', '$7,925,000', '1st Quarter 2021'],
  ]
  const wids = [2100, 1400, 1500, 1200, 1560, 1600]
  return [
    subHeading("PCRE'S SAMPLE OF OUR RECENTLY COMPLETED SALES TRANSACTIONS"),
    spacer(40, 60),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: wids,
      rows: [
        darkHeaderRow(['Property Address', 'City', 'Property Type', 'Building Size (SF)', 'Sale Price', 'Transaction Date'], wids),
        ...sales.map((row, i) => dataRow(row, wids, i % 2 === 1)),
      ],
    }),
  ]
}

// ── PCRE COMPLETED LEASE TRANSACTIONS TABLE ───────────────────────────────────
function buildRecentLeasesTable(): AnyEl[] {
  const leases = [
    ['1460 N Clinton Ave', 'Bay Shore', 'Absolute Home Contracting', '2,000', '$20.00 PSF', '3rd Quarter 2025'],
    ['99 Seaview Blvd', 'Port Washington', 'Pyramid Flooring', '9,000', '$18.00 PSF', '2nd Quarter 2025'],
    ['80 13th Ave', 'Ronkonkoma', 'Demil Corp', '7,500', '$15.00 PSF', '2nd Quarter 2025'],
    ['170 Express St', 'Plainview', 'Life Plus Style Gourmet', '42,000', '$12.00 Gross', '2nd Quarter 2025'],
    ['40 Rabro Dr', 'Hauppauge', 'Blue Point Dance', '6,900', '$17.40 Gross', '3rd Quarter 2025'],
    ['260 Spagnoli Rd', 'Melville', 'LIBM Inc.', '54,000', '$17.00 Gross', '2nd Quarter 2025'],
    ['47 Mall Dr', 'Commack', 'eBizware', '10,000', '$17.50 Gross', '2nd Quarter 2025'],
    ['1980 New Highway', 'Farmingdale', 'Top Bright Inc.', '26,500', '$16.00 Gross', '1st Quarter 2025'],
    ['143 Pine Aire Dr', 'Bay Shore', 'Mulligan Restoration', '12,300', '$17.00 Gross', '1st Quarter 2025'],
    ['1765 Expressway Dr N', 'Hauppauge', 'Capitol Building Supply', '13,500', '$16.36 Gross', '3rd Quarter 2024'],
    ['50 Wireless Blvd', 'Hauppauge', 'Universal Perfumes & Cosmetics', '15,000', '$16.00 Gross', '3rd Quarter 2024'],
    ['5005 Veterans Mem Hwy', 'Holbrook', 'Cookies United, LLC', '38,000', '$14.50 Gross', '3rd Quarter 2024'],
    ['1707 Veterans Mem Hwy', 'Islandia', 'Victims Info Bureau of Suffolk', '18,886', '$21.00 Gross', '3rd Quarter 2024'],
    ['700 Chettic Avenue', 'Copiague', 'Green Earth Duct Cleaning', '17,500', '$13.50 Gross', '4th Quarter 2024'],
  ]
  const wids = [1800, 1300, 2100, 900, 1360, 1900]
  return [
    new Paragraph({ children: [new PageBreak()] }),
    subHeading("PCRE'S SAMPLE OF OUR RECENTLY COMPLETED LEASE TRANSACTIONS"),
    spacer(40, 60),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: wids,
      rows: [
        darkHeaderRow(['Property Address', 'City', 'Tenant', 'Leased SF', 'Lease Price (PSF)', 'Transaction Date'], wids),
        ...leases.map((row, i) => dataRow(row, wids, i % 2 === 1)),
      ],
    }),
  ]
}

// ── MAIN ROUTE ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    subject, comps, leaseComps, avails, analytics,
    includeLeaseComps = true,
    includeAvails = true,
    includeMarketingStrategy = true,
    includePcreProfile = true,
  } = body

  // Load logo
  const logoPath = path.join(process.cwd(), 'public', 'pcre_logo.png')
  const logoData = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null

  async function fetchPropertyPhoto(photoUrl: string | undefined, address: string | undefined): Promise<Buffer | null> {
    if (photoUrl) return fetchImageBuffer(photoUrl)
    if (!address) return null
    const key = process.env.GOOGLE_MAPS_KEY
    if (!key) return null
    const encoded = encodeURIComponent(address + ', NY')
    return fetchImageBuffer(`https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encoded}&key=${key}&return_error_code=true`)
  }

  // Pre-fetch all photos
  const compPhotos = await Promise.all(
    (comps || []).map((c: Record<string, unknown>) =>
      fetchPropertyPhoto(c.photo_url as string | undefined, c.address as string | undefined)
    )
  )
  const leaseCompPhotos = await Promise.all(
    (leaseComps || []).map((c: Record<string, unknown>) =>
      fetchPropertyPhoto(c.photo_url as string | undefined, c.address as string | undefined)
    )
  )
  const availPhotos = await Promise.all(
    (avails || []).map((a: Record<string, unknown>) =>
      fetchPropertyPhoto(a.photo_url as string | undefined, a.address as string | undefined)
    )
  )

  const now = new Date()
  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()

  // ── LOGO ELEMENTS ────────────────────────────────────────────────────────────
  const logoLarge: AnyEl = logoData
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data: logoData, transformation: { width: 220, height: 54 } })],
        spacing: { after: 40 },
      })
    : new Paragraph({ children: [new TextRun({ text: 'PREMIER COMMERCIAL REAL ESTATE', bold: true, size: 32, font: 'Arial' })] })

  const logoSmall: AnyEl = logoData
    ? new Paragraph({
        children: [new ImageRun({ type: 'png', data: logoData, transformation: { width: 150, height: 37 } })],
      })
    : new Paragraph({ children: [new TextRun({ text: 'PCRE', bold: true, size: 18, font: 'Arial' })] })

  // ── PAGE HEADER / FOOTER ─────────────────────────────────────────────────────
  const pageHeader = new Header({
    children: [
      logoSmall,
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 2 } }, children: [] }),
    ],
  })

  const pageFooter = new Footer({
    children: [new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: BORDER_CLR, space: 2 } },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: '"Complex Issues – Simple Solutions"', italic: true, size: 16, font: 'Arial', color: '666666' }),
        new TextRun({ text: '\tPage ', size: 16, font: 'Arial', color: '666666' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '666666' }),
      ],
    })],
  })

  // ── COVER PAGE ───────────────────────────────────────────────────────────────
  const preparedBy = subject?.preparedBy || 'JASON MILLER & JB SCHWARTZBERG'
  const coverChildren: AnyEl[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '"COMPLEX ISSUES – SIMPLE SOLUTIONS"', italic: true, size: 20, font: 'Arial', color: '555555' })],
      spacing: { before: 0, after: 280 },
    }),
    logoLarge,
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 6 } }, children: [], spacing: { after: 480 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'OPINION OF VALUE', bold: true, size: 60, font: 'Arial', color: DARK })],
      spacing: { after: 160 },
    }),
    thinRule(),
    spacer(200, 200),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'DATE PREPARED:', bold: true, size: 20, font: 'Arial', color: '555555' })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: monthYear, bold: true, size: 22, font: 'Arial', color: DARK })],
      spacing: { after: 280 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'PROPERTY ADDRESS:', bold: true, size: 20, font: 'Arial', color: '555555' })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: (subject?.address || '[SUBJECT PROPERTY ADDRESS]').toUpperCase(), bold: true, size: 30, font: 'Arial', color: DARK })],
      spacing: { after: 40 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${subject?.city ? subject.city.toUpperCase() + ', ' : ''}NEW YORK`, size: 24, font: 'Arial', color: '444444' })],
      spacing: { after: 280 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'PREPARED BY:', bold: true, size: 20, font: 'Arial', color: '555555' })],
      spacing: { after: 120 },
    }),
    spacer(120, 480),
    thinRule(),
    spacer(120, 120),
    // Broker contact table
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3120, 3120, 3120],
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders: { ...bNone, right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_CLR } }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Jason Miller', bold: true, size: 22, font: 'Arial', color: DARK })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Managing Principal', size: 18, font: 'Arial', color: '555555' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '516.413.1690', size: 18, font: 'Arial', color: '555555' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Jmiller@pcrellc.com', size: 18, font: 'Arial', color: '555555' })] }),
        ]}),
        new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders: { ...bNone, right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_CLR } }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'JB (Jeff) Schwartzberg', bold: true, size: 22, font: 'Arial', color: DARK })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Managing Principal', size: 18, font: 'Arial', color: '555555' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '516.857.8013', size: 18, font: 'Arial', color: '555555' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Jbs@pcrellc.com', size: 18, font: 'Arial', color: '555555' })] }),
        ]}),
        new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders: bNone, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Desmond Mullins', bold: true, size: 22, font: 'Arial', color: DARK })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Partner, Executive Director', size: 18, font: 'Arial', color: '555555' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '631.398.5654', size: 18, font: 'Arial', color: '555555' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Dmullins@pcrellc.com', size: 18, font: 'Arial', color: '555555' })] }),
        ]}),
      ]})],
    }),
    spacer(120, 80),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Premier Commercial Real Estate, LLC  |  500 N. Broadway, Suite 105, Jericho, NY 11753', italic: true, size: 17, font: 'Arial', color: '666666' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Main: 516.284.8000  |  www.pcrellc.com', size: 17, font: 'Arial', color: '666666' })] }),
  ]

  // ── TABLE OF CONTENTS ────────────────────────────────────────────────────────
  let sectionNum = 1
  const tocEntries: string[] = []
  tocEntries.push(`I.  EXECUTIVE SUMMARY`)
  tocEntries.push(`II.  BUILDING DESCRIPTION`)
  tocEntries.push(`III.  OPINION OF VALUE`)
  if ((comps || []).length > 0) tocEntries.push(`IV.  RECENT INVESTMENT/SALE TRANSACTIONS`)
  if (includeLeaseComps && (leaseComps || []).length > 0) tocEntries.push(`V.  RECENT LEASE TRANSACTIONS`)
  if (includeAvails && (avails || []).length > 0) tocEntries.push(`VI.  MARKET AVAILABILITIES`)
  if (includeMarketingStrategy) tocEntries.push(`VII.  MARKETING STRATEGY`)
  if (includePcreProfile) tocEntries.push(`VIII.  PREMIER COMMERCIAL REAL ESTATE PROFILE`)

  const tocChildren: AnyEl[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'TABLE OF CONTENTS', bold: true, size: 28, font: 'Arial', color: DARK })],
      spacing: { before: 0, after: 160 },
    }),
    goldRule(),
    spacer(120, 80),
    ...tocEntries.map((entry, i) => new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: entry, size: 20, font: 'Arial', color: DARK }),
        new TextRun({ text: `\t${i + 2}`, size: 20, font: 'Arial', color: '888888' }),
      ],
      spacing: { before: 120, after: 40 },
      border: { bottom: { style: BorderStyle.DOTTED, size: 1, color: BORDER_CLR, space: 4 } },
    })),
  ]

  // ── SECTION I — EXECUTIVE SUMMARY ────────────────────────────────────────────
  const opvType = subject?.opvType || 'investment'
  const purposeText = opvType === 'investment'
    ? 'DETERMINE CURRENT MARKET VALUE OF THE PROPERTY AS AN INVESTMENT SALE'
    : opvType === 'lease'
    ? 'DETERMINE CURRENT MARKET RENTAL RATE FOR THE PROPERTY'
    : 'DETERMINE CURRENT MARKET VALUE OF THE PROPERTY FOR SALE'

  const execChildren: AnyEl[] = [
    sectionHeading('I', 'EXECUTIVE SUMMARY'),
    spacer(80, 40),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2200, 7160],
      rows: [
        new TableRow({ children: [
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 0, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'PURPOSE OF OPINION:', bold: true, size: 19, font: 'Arial', color: DARK })] })] }),
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 80, right: 0 }, children: [new Paragraph({ children: [new TextRun({ text: purposeText, size: 19, font: 'Arial', color: DARK })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 0, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'DATE OF OPINION:', bold: true, size: 19, font: 'Arial', color: DARK })] })] }),
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 80, right: 0 }, children: [new Paragraph({ children: [new TextRun({ text: monthYear, size: 19, font: 'Arial', color: DARK })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 0, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'ADDRESS:', bold: true, size: 19, font: 'Arial', color: DARK })] })] }),
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 80, right: 0 }, children: [
            new Paragraph({ children: [new TextRun({ text: (subject?.address || '—').toUpperCase(), size: 19, font: 'Arial', color: DARK })] }),
            new Paragraph({ children: [new TextRun({ text: `${subject?.city ? subject.city.toUpperCase() : ''}, NEW YORK`, size: 19, font: 'Arial', color: DARK })] }),
          ]}),
        ]}),
        ...(subject?.municipality ? [new TableRow({ children: [
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 0, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'MUNICIPALITY:', bold: true, size: 19, font: 'Arial', color: DARK })] })] }),
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 80, right: 0 }, children: [new Paragraph({ children: [new TextRun({ text: subject.municipality as string, size: 19, font: 'Arial', color: DARK })] })] }),
        ]})] : []),
        new TableRow({ children: [
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 0, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'COUNTY:', bold: true, size: 19, font: 'Arial', color: DARK })] })] }),
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 80, right: 0 }, children: [new Paragraph({ children: [new TextRun({ text: (subject?.county || '—').toUpperCase(), size: 19, font: 'Arial', color: DARK })] })] }),
        ]}),
        ...(subject?.parcelId ? [new TableRow({ children: [
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 0, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'PARCEL ID:', bold: true, size: 19, font: 'Arial', color: DARK })] })] }),
          new TableCell({ borders: bNone, margins: { top: 80, bottom: 80, left: 80, right: 0 }, children: [new Paragraph({ children: [new TextRun({ text: subject.parcelId as string, size: 19, font: 'Arial', color: DARK })] })] }),
        ]})] : []),
      ],
    }),
    spacer(160, 80),
    new Paragraph({
      children: [new TextRun({ text: 'PROPERTY SUMMARY HIGHLIGHTS AND ASSUMPTIONS:', bold: true, size: 21, font: 'Arial', color: DARK })],
      spacing: { before: 80, after: 120 },
    }),
    ...[
      subject?.size ? `The building is approximately ${Number(subject.size).toLocaleString()} sq. ft. in total.` : null,
      subject?.ceiling ? `Ceiling height of ${subject.ceiling}' clear.` : null,
      subject?.docks || subject?.driveIn ? `${subject?.docks || '—'} loading dock(s) and ${subject?.driveIn || '—'} drive-in door(s).` : null,
      subject?.sprinkler ? `${subject.sprinkler} sprinkler system.` : null,
      subject?.sewer ? `Sewer: ${subject.sewer}.` : null,
      subject?.power ? `Electrical service: ${subject.power}.` : null,
      subject?.taxes ? `Real Estate Taxes are ${fmt(subject.taxes, '$')} or approximately $${subject.size ? (Number(subject.taxes) / Number(subject.size)).toFixed(2) : '—'} PSF.` : null,
      subject?.lot ? `The building sits on a parcel of approximately ${subject.lot} acres.` : null,
      subject?.notes || null,
    ].filter(Boolean).map((t) => bullet(t as string)),
    spacer(120, 80),
    new Paragraph({
      children: [new TextRun({ text: 'HIGHEST AND BEST USE:', bold: true, size: 21, font: 'Arial', color: DARK })],
      spacing: { before: 80, after: 120 },
    }),
    ...(subject?.highestBestUse
      ? (subject.highestBestUse as string).split('\n').filter(Boolean).map((u: string) => bullet(u.trim()))
      : [
          bullet('Manufacturing'),
          bullet('Wholesale Operation'),
          bullet('Warehouse / Distribution'),
        ]),
  ]

  // ── SECTION II — BUILDING DESCRIPTION ────────────────────────────────────────
  const buildingChildren: AnyEl[] = [
    new Paragraph({ children: [new PageBreak()] }),
    sectionHeading('II', 'BUILDING DESCRIPTION'),
    spacer(80, 60),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3240, 6120],
      rows: [
        labelRow('PROPERTY ADDRESS', `${subject?.address || '—'}${subject?.city ? ', ' + subject.city : ''}`, ),
        labelRow('TOTAL BUILDING SF', fmt(subject?.size, '', ' SF'), true),
        ...(subject?.officePct ? [labelRow('OFFICE', `${subject.officePct}%`)] : []),
        labelRow('TOTAL SITE ACREAGE', subject?.lot ? `${subject.lot} AC` : '—', !subject?.officePct),
        labelRow('CEILING HEIGHT', subject?.ceiling ? `${subject.ceiling}' clear` : '—', !!subject?.officePct),
        labelRow('DRIVE-IN DOORS', subject?.driveIn || '—', !subject?.officePct),
        labelRow('LOADING DOCKS', subject?.docks || '—', !!subject?.officePct || !subject?.officePct),
        labelRow('HEAT', subject?.heat || '—', false),
        labelRow('POWER', subject?.power || '—', true),
        labelRow('PARKING', subject?.parking || '—', false),
        labelRow('SPRINKLER SYSTEM', subject?.sprinkler || '—', true),
        labelRow('SEWER CONNECTION', subject?.sewer || '—', false),
        labelRow('ZONING', subject?.zoning || '—', true),
        labelRow('REAL ESTATE TAXES', subject?.taxes ? fmt(subject.taxes, '$', '/yr') + (subject.size ? ` / $${(Number(subject.taxes)/Number(subject.size)).toFixed(2)} PSF` : '') : '—', false),
        ...(subject?.yearBuilt ? [labelRow('YEAR BUILT', subject.yearBuilt as string, true)] : []),
        ...(subject?.construction ? [labelRow('CONSTRUCTION', subject.construction as string, false)] : []),
        ...(subject?.condition ? [labelRow('CONDITION', subject.condition as string, true)] : []),
      ],
    }),
  ]

  // ── SECTION III — OPINION OF VALUE ───────────────────────────────────────────
  const avgPsf = analytics?.avgPricePsf || (comps?.length
    ? comps.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.price_per_sf) || 0), 0) / comps.length
    : 0)

  // Calculate total value range from PSF × building SF
  const bldgSF = Number(subject?.size) || 0
  const valLowPsf = Number(subject?.estimatedValueLow) || 0
  const valHighPsf = Number(subject?.estimatedValueHigh) || 0
  const valLowTotal = bldgSF && valLowPsf ? bldgSF * valLowPsf : 0
  const valHighTotal = bldgSF && valHighPsf ? bldgSF * valHighPsf : 0

  const ovChildren: AnyEl[] = [
    new Paragraph({ children: [new PageBreak()] }),
    sectionHeading('III', 'OPINION OF VALUE'),
    spacer(80, 80),
    bodyText('Based upon the aforementioned assumptions, our knowledge of current market conditions, and a review of the Comparables found in Section IV.'),
    spacer(80, 60),
    // Header row: Per SF | Total
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1200, 4080, 4080],
      rows: [
        new TableRow({ children: [
          new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders: bAll, shading: { fill: GRAY_HDR, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 120, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'Estimated Value For Sale', bold: true, size: 18, font: 'Arial', color: WHITE })] })] }),
          new TableCell({ width: { size: 4080, type: WidthType.DXA }, borders: bAll, shading: { fill: GRAY_HDR, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 120, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Per SF', bold: true, size: 18, font: 'Arial', color: WHITE })] })] }),
          new TableCell({ width: { size: 4080, type: WidthType.DXA }, borders: bAll, shading: { fill: GRAY_HDR, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 120, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Total', bold: true, size: 18, font: 'Arial', color: WHITE })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: 1200, type: WidthType.DXA }, borders: bAll, shading: { fill: MID_GRAY, type: ShadingType.CLEAR }, margins: { top: 140, bottom: 140, left: 120, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: '', size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4080, type: WidthType.DXA }, borders: bAll, shading: { fill: 'FFF8E1', type: ShadingType.CLEAR }, margins: { top: 140, bottom: 140, left: 120, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({
            text: valLowPsf && valHighPsf ? `$${valLowPsf.toFixed(2)} - $${valHighPsf.toFixed(2)}` : avgPsf ? `$${Number(avgPsf).toFixed(2)}` : '[ __________ ]',
            bold: true, size: 22, font: 'Arial', color: GOLD })] })] }),
          new TableCell({ width: { size: 4080, type: WidthType.DXA }, borders: bAll, shading: { fill: 'FFF8E1', type: ShadingType.CLEAR }, margins: { top: 140, bottom: 140, left: 120, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({
            text: valLowTotal && valHighTotal ? `$${valLowTotal.toLocaleString()} - $${valHighTotal.toLocaleString()}` : bldgSF && avgPsf ? `$${Math.round(bldgSF * avgPsf).toLocaleString()}` : '[ __________ ]',
            bold: true, size: 22, font: 'Arial', color: GOLD })] })] }),
        ]}),
      ],
    }),
    ...(subject?.opvType === 'investment' || subject?.capRateLow ? [
      spacer(140, 80),
      bodyText('The value shall be established as a function of:'),
      bullet('A "Fair Market" Rental Rate for an acceptable lease term.'),
      bullet('An acceptable Rate of Return (Cap Rate) to the investor/Purchaser.'),
      spacer(80, 60),
      bodyText('Given the above, consider;'),
      spacer(60, 60),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3800, 5560],
        rows: [
          ...(subject?.leasePsfLow || subject?.leasePsfHigh ? [new TableRow({ children: [
            new TableCell({ width: { size: 3800, type: WidthType.DXA }, borders: bAll, shading: { fill: MID_GRAY, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'Lease/Rental Rate (Year 1)', bold: true, size: 19, font: 'Arial', color: DARK })] })] }),
            new TableCell({ width: { size: 5560, type: WidthType.DXA }, borders: bAll, margins: { top: 100, bottom: 100, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `$${subject.leasePsfLow} to $${subject.leasePsfHigh} PSF NNN`, size: 19, font: 'Arial', color: DARK })] })] }),
          ]})] : []),
          ...(subject?.capRateLow || subject?.capRateHigh ? [new TableRow({ children: [
            new TableCell({ width: { size: 3800, type: WidthType.DXA }, borders: bAll, shading: { fill: MID_GRAY, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'Cap Rate', bold: true, size: 19, font: 'Arial', color: DARK })] })] }),
            new TableCell({ width: { size: 5560, type: WidthType.DXA }, borders: bAll, margins: { top: 100, bottom: 100, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `${subject.capRateLow}% to ${subject.capRateHigh}%`, size: 19, font: 'Arial', color: DARK })] })] }),
          ]})] : []),
          new TableRow({ children: [
            new TableCell({ width: { size: 3800, type: WidthType.DXA }, borders: bAll, shading: { fill: MID_GRAY, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'Valuation', bold: true, size: 19, font: 'Arial', color: DARK })] })] }),
            new TableCell({ width: { size: 5560, type: WidthType.DXA }, borders: bAll, margins: { top: 100, bottom: 100, left: 140, right: 80 }, children: [
              new Paragraph({ children: [new TextRun({ text: valLowPsf && valHighPsf ? `$${valLowPsf.toFixed(2)} PSF to $${valHighPsf.toFixed(2)} PSF` : '[ __________ ]', size: 19, font: 'Arial', color: DARK })] }),
              new Paragraph({ children: [new TextRun({ text: valLowTotal && valHighTotal ? `$${valLowTotal.toLocaleString()} - $${valHighTotal.toLocaleString()}` : '', size: 19, font: 'Arial', color: DARK })] }),
            ]}),
          ]}),
        ],
      }),
    ] : []),
  ]

  // ── SECTION IV — SALE / INVESTMENT COMPS ─────────────────────────────────────
  const saleCompChildren: AnyEl[] = []
  if ((comps || []).length > 0) {
    const isInvestment = subject?.opvType === 'investment'
    const sectionTitle = isInvestment ? 'RECENT INVESTMENT TRANSACTIONS' : 'RECENT SALE TRANSACTIONS'
    const cWids = isInvestment ? [2800, 1400, 1560, 1800, 1800] : [2800, 1400, 1560, 1800, 1800]
    const cHeaders = isInvestment
      ? ['Property Address', 'City', 'Building Size (SF)', 'Sale Price', 'Cap Rate']
      : ['Property Address', 'City', 'Building Size (SF)', 'Sale Price', 'Price PSF']
    saleCompChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      sectionHeading('IV', sectionTitle),
      spacer(80, 60),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: cWids,
        rows: [
          darkHeaderRow(cHeaders, cWids),
          ...(comps || []).map((c: Record<string, unknown>, i: number) => dataRow([
            `${c.address || ''}`,
            `${c.city || ''}`,
            c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—',
            fmt(c.sale_price as number, '$'),
            isInvestment
              ? (c.cap_rate ? `${c.cap_rate}%` : '—')
              : (c.price_per_sf || (c.sale_price && c.building_sf) ? `$${(Number(c.price_per_sf) || Number(c.sale_price)/Number(c.building_sf)).toFixed(2)}` : '—'),
          ], cWids, i % 2 === 1)),
        ],
      }),
      spacer(80, 60),
      bodyText('Each comparable transaction is detailed on the following pages.'),
      ...(comps || []).flatMap((c: Record<string, unknown>, i: number) =>
        buildCompPage(c, i, compPhotos[i], 'sale')
      )
    )
  }

  // ── SECTION V — LEASE COMPS ───────────────────────────────────────────────────
  const leaseCompChildren: AnyEl[] = []
  if (includeLeaseComps && (leaseComps || []).length > 0) {
    const lWids = [3000, 1600, 2160, 2600]
    leaseCompChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      sectionHeading('V', 'RECENT LEASE TRANSACTIONS'),
      spacer(80, 60),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: lWids,
        rows: [
          darkHeaderRow(['Property Address', 'City', 'Building Size (SF)', 'Lease Price (PSF)'], lWids),
          ...(leaseComps || []).map((c: Record<string, unknown>, i: number) => dataRow([
            `${c.address || ''}`,
            `${c.city || ''}`,
            c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—',
            (c.lease_price as string) || (c.price_per_sf ? `$${Number(c.price_per_sf).toFixed(2)} PSF NNN` : '—'),
          ], lWids, i % 2 === 1)),
        ],
      }),
      spacer(80, 60),
      bodyText('Each comparable lease transaction is detailed on the following pages.'),
      ...(leaseComps || []).flatMap((c: Record<string, unknown>, i: number) =>
        buildCompPage(c, i, leaseCompPhotos[i], 'lease')
      )
    )
  }

  // ── SECTION VI — MARKET AVAILABILITIES ───────────────────────────────────────
  const availChildren: AnyEl[] = []
  if (includeAvails && (avails || []).length > 0) {
    const aWids = [2600, 1200, 1200, 1160, 1600, 1600]
    availChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      sectionHeading('VI', 'MARKET AVAILABILITIES'),
      spacer(80, 60),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: aWids,
        rows: [
          darkHeaderRow(['Property Address', 'City', 'Bldg SF', 'Lot Size', 'Asking Price', 'Price PSF'], aWids),
          ...(avails || []).map((a: Record<string, unknown>, i: number) => dataRow([
            `${a.address || ''}`,
            `${a.city || ''}`,
            fmt(a.building_sf as number),
            fmt(a.lot_size_ac as number, '', ' AC'),
            fmt(a.asking_price as number, '$'),
            a.asking_price && a.building_sf ? `$${(Number(a.asking_price) / Number(a.building_sf)).toFixed(2)}` : '—',
          ], aWids, i % 2 === 1)),
        ],
      }),
      spacer(80, 60),
      bodyText('Each market availability is detailed on the following pages.'),
      ...(avails || []).flatMap((a: Record<string, unknown>, i: number) =>
        buildCompPage(a, i, availPhotos[i], 'sale')
      )
    )
  }

  // ── SECTION VII — MARKETING STRATEGY ─────────────────────────────────────────
  const marketingChildren: AnyEl[] = []
  if (includeMarketingStrategy) {
    marketingChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      sectionHeading('VII', 'MARKETING STRATEGY'),
      spacer(80, 60),
      subHeading('FOCUSED DEDICATION / HARD WORK… TO INCLUDE:'),
      bullet('PREMIER COMMERCIAL REAL ESTATE will prepare electronic marketing material and meet with selected "Highly qualified" buyers.'),
      bullet('PREMIER COMMERCIAL REAL ESTATE will distribute e-Blast marketing flyers to the local brokerage community (including the outer NYC Boroughs).'),
      bullet('PREMIER COMMERCIAL REAL ESTATE will prepare all proposals and respond to proposals submitted by prospective purchasers after receiving authorization from ownership.'),
      bullet('PREMIER COMMERCIAL REAL ESTATE will conduct all site inspections and conduct marketing presentations for purchasers.'),
      bullet('PREMIER COMMERCIAL REAL ESTATE will implement and follow up on a direct marketing program including: Identification of qualified prospects; Mailings (electronic and regular) to prospective Investors; Regular follow-up phone canvassing; Regular follow-up "in-person" canvassing; and Follow-up correspondence.'),
      spacer(120, 80),
      subHeading('HOW DOES PARTNERING WITH PREMIER DIFFER FROM "THE CROWD"?'),
      bullet('We always maintain a "Client First" philosophy.'),
      bullet('We view our clients as "Partners" – our economic interests are precisely aligned.'),
      bullet('Industrial leasing & sales are all that we do.'),
      bullet('Our market knowledge is "top in the business" which will serve us to maximize value.'),
      bullet('Combined over 40 years experience – specializing in Industrial Properties (Total Sales Transactions exceed $500 Million).'),
      bullet('In 2020 we brokered the largest industrial sales transactions in both Suffolk and Nassau counties ($35.5 Million and $33 Million respectively).'),
      bullet('We have built strong relationships with highly qualified purchasers and investors over several decades.'),
      bullet('We are recognized as "leaders" within the commercial brokerage community.'),
      bullet('Our Brokerage Agreement is simple; doesn\'t lock you in; lets you cancel at any time and for any reason.'),
    )
  }

  // ── SECTION VIII — PCRE PROFILE ───────────────────────────────────────────────
  const profileChildren: AnyEl[] = []
  if (includePcreProfile) {
    profileChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      sectionHeading('VIII', 'PREMIER COMMERCIAL REAL ESTATE PROFILE'),
      spacer(80, 60),
      bodyText('Premier Commercial Real Estate, LLC is a full-service commercial real estate service provider offering personalized and strategic solutions for investors, property owners, tenants and diverse businesses. With a laser-sharp focus on, and in-depth knowledge of the Long Island market, Premier\'s seasoned professionals work together as a team to identify the best real estate opportunities for its clients.'),
      spacer(60, 60),
      bodyText('From property sales and leasing to tax-advantaged 1031 exchanges and portfolio development, Premier applies the full force of its experience, know-how and network to effectively achieve the real estate goals of its clients. This approach, combined with Premier\'s strong work ethic, professional integrity and unwavering commitment to meeting its clients\' needs has made the company one of the region\'s fastest-growing real estate firms.'),
      spacer(120, 80),
      ...buildRecentSalesTable(),
      spacer(80, 80),
      ...buildRecentLeasesTable(),
      spacer(160, 80),
      // Jason bio
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        children: [new TextRun({ text: 'JASON D. MILLER', bold: true, size: 28, font: 'Arial', color: DARK })],
        spacing: { after: 40 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 3 } },
      }),
      new Paragraph({ children: [new TextRun({ text: 'Managing Principal', bold: true, size: 22, font: 'Arial', color: '555555' })], spacing: { before: 80, after: 120 } }),
      bodyText('Jason Miller is Co-Founder and Managing Principal at Premier Commercial Real Estate with over 17 years experience, and is widely recognized as one of Long Island\'s top commercial real estate professionals. During his career, Mr. Miller has represented a substantial number of satisfied clients and customers, successfully completing an extraordinary number of sales and leasing transactions, totaling several million square feet of space.'),
      spacer(60, 60),
      bodyText('Mr. Miller began his real estate career as a Sales Associate at Sutton & Edwards Inc (now Colliers International, LI Inc.) and was quickly promoted to the position of Senior Director, Industrial Properties for Long Island. In October of 2013, along with his partner Jeff Schwartzberg, he created Premier Commercial Real Estate, a brokerage firm strictly focused on delivering ultimate customer service.'),
      spacer(60, 60),
      bodyText('Since Premier\'s inception, Jason and his company have received a number of the industry\'s top awards, including: "Commercial Brokerage Company of the Year" (LIBN 2015); Largest Industrial Sales Transactions in Nassau and Suffolk Counties (2015 & 2016); and Co-Star Power Broker Award each year.'),
      spacer(160, 80),
      // Jeff bio
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        children: [new TextRun({ text: 'JEFFREY SCHWARTZBERG', bold: true, size: 28, font: 'Arial', color: DARK })],
        spacing: { after: 40 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 3 } },
      }),
      new Paragraph({ children: [new TextRun({ text: 'Managing Principal', bold: true, size: 22, font: 'Arial', color: '555555' })], spacing: { before: 80, after: 120 } }),
      bodyText('JB (Jeff) Schwartzberg, Co-Founder and Managing Principal at Premier Commercial Real Estate, has developed a vast background and proven track record in commercial real estate spanning over three decades. Mr. Schwartzberg brings that knowledge to Premier, leading its\' day-to-day business operations. He is widely recognized in the industry as one of Long Island\'s Top commercial real estate professionals.'),
      spacer(60, 60),
      bodyText('Before becoming a full time Broker, Jeff enjoyed a successful and extensive 20-year career, holding several key "senior executive" positions in the Defense Industry, with Sperry/Unisys/Loral/Lockheed Martin Corporations. This was followed by several years as a Senior Investment Officer at First Industrial Realty Trust. Immediately prior to creating Premier in 2013, Mr. Schwartzberg spent more than a decade with Colliers International, ultimately rising to the position of Senior Executive Director, Industrial Properties-Long Island.'),
      spacer(60, 60),
      bodyText('He has been named a Co-Star "Power Broker" every year and has participated in industrial property sales and leases involving millions of square feet. In 2023, Jeff was honored & received Long Island Business News\' most prestigious award "Top Commercial Broker on Long Island."'),
    )
  }

  // ── ASSEMBLE DOCUMENT ─────────────────────────────────────────────────────────
  const doc = new Document({
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [
      // Cover page (no header/footer)
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 } } },
        children: coverChildren,
      },
      // Table of Contents
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers: { default: pageHeader },
        footers: { default: pageFooter },
        children: tocChildren,
      },
      // Main content
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers: { default: pageHeader },
        footers: { default: pageFooter },
        children: [
          ...execChildren,
          ...buildingChildren,
          ...ovChildren,
          ...saleCompChildren,
          ...leaseCompChildren,
          ...availChildren,
          ...marketingChildren,
          ...profileChildren,
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = `OPV_${(subject?.address || 'Report').replace(/[^a-zA-Z0-9]/g, '_')}_${monthYear.replace(/ /g, '_')}.docx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
