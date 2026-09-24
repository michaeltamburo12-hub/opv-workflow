export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  AlignmentType, WidthType, ShadingType, BorderStyle, PageBreak, ImageRun,
} from 'docx'

// ── Constants ──────────────────────────────────────────────────────────────
const NAVY   = '1C3557'
const GOLD   = 'C5972B'
const LGRAY  = 'F2F2F2'
const MGRAY  = 'EBEBEB'
const WHITE  = 'FFFFFF'
const W      = 9360          // total content width in twips
const L_COL  = 2500          // label column width
const V_COL  = W - L_COL    // value column width

const thinBorder = { style: BorderStyle.SINGLE, size: 4,  color: 'CCCCCC' }
const noBorder   = { style: BorderStyle.NONE,   size: 0,  color: 'FFFFFF' }
const allThin    = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
const allNone    = { top: noBorder,   bottom: noBorder,   left: noBorder,   right: noBorder   }

const fmtDate = (d: string) => d ? new Date(d+' ').toLocaleDateString('en-US',{month:'long',year:'numeric'}) : '—'
const str     = (v: any) => (v!=null&&v!=='') ? String(v) : '—'

// ── PCRE fallback transactions (from Generate Package) ─────────────────────
const FALLBACK_SALES = [
  ['128 Spagnoli Rd','Melville','Redevelopment','150,000','$21,000,000','3rd Qtr 2025'],
  ['48 Mall Dr','Commack','Industrial','20,000','$4,700,000','2nd Qtr 2025'],
  ['22 Sutton Place','Brewster','Industrial','70,000','Undisclosed','1st Qtr 2025'],
  ['474 Grand Blvd','Westbury','Industrial','71,000','$14,250,000','4th Qtr 2024'],
  ['145 Kennedy Dr','Hauppauge','Industrial','40,000','$8,150,000','3rd Qtr 2024'],
  ['200 Central Ave','Farmingdale','Industrial','25,000','$5,875,000','2nd Qtr 2024'],
  ['218 Front St','Hempstead','Industrial','30,183','$4,750,000','1st Qtr 2024'],
  ['30 Eastern Ave','Deer Park','Industrial','11,940','$2,200,000','1st Qtr 2024'],
  ['81 Modular Ave','Commack','Industrial','30,000','$6,150,000','4th Qtr 2023'],
]
const FALLBACK_LEASES = [
  ['1460 N Clinton Ave','Bay Shore','Absolute Home Contracting','2,000','$20.00 PSF','3rd Qtr 2025'],
  ['99 Seaview Blvd','Port Washington','Pyramid Flooring','9,000','$18.00 PSF','2nd Qtr 2025'],
  ['80 13th Ave','Ronkonkoma','Demil Corp','7,500','$15.00 PSF','2nd Qtr 2025'],
  ['170 Express St','Plainview','Life Plus Style Gourmet','42,000','$12.00 Gross','2nd Qtr 2025'],
  ['40 Rabro Dr','Hauppauge','Blue Point Dance','6,900','$17.40 Gross','3rd Qtr 2025'],
  ['260 Spagnoli Rd','Melville','LIBM Inc.','54,000','$17.00 Gross','2nd Qtr 2025'],
  ['47 Mall Dr','Commack','eBizware','10,000','$17.50 Gross','2nd Qtr 2025'],
  ['1980 New Highway','Farmingdale','Top Bright Inc.','26,500','$16.00 Gross','1st Qtr 2025'],
]

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
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}

function loadPublicFile(filename: string): Buffer | null {
  try { return fs.readFileSync(path.join(process.cwd(), 'public', filename)) }
  catch (e) { console.error(`loadPublicFile failed for ${filename}:`, e); return null }
}

function makeImgRun(buf: Buffer, width: number, height: number): ImageRun | null {
  for (const type of ['jpeg','png','jpg','gif'] as const) {
    try { return new ImageRun({ data: buf, transformation: { width, height }, type }) }
    catch { continue }
  }
  return null
}

function photoPara(buf: Buffer|null, width=500, height=260): Paragraph {
  if (buf) {
    const img = makeImgRun(buf, width, height)
    if (img) return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [img] })
  }
  return new Paragraph({ text: '', spacing: { before: 80, after: 80 } })
}

// ── Paragraph helpers ──────────────────────────────────────────────────────
function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY } },
    children: [new TextRun({ text, bold: true, size: 24, color: NAVY, font: 'Arial' })],
  })
}

function subhead(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    children: [new TextRun({ text, bold: true, size: 20, font: 'Arial', color: '333333' })],
  })
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 20, font: 'Arial' })],
  })
}

function body(text: string, italic = false): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 22, font: 'Arial', italics: italic })],
  })
}

function center(text: string, size = 22, bold = false, color = '000000'): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size, bold, color, font: 'Arial' })],
  })
}

function spacer(lines = 1): Paragraph {
  return new Paragraph({ text: '', spacing: { before: 0, after: lines * 120 } })
}

function tocEntry(label: string, page: string | number): Paragraph {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: 'CCCCCC' } },
    children: [
      new TextRun({ text: label, size: 20, font: 'Arial' }),
      new TextRun({ text: `  ${page}`, size: 20, font: 'Arial', color: '999999' }),
    ],
  })
}

// ── Table helpers ──────────────────────────────────────────────────────────
function labelRow(label: string, value: string, shade = false): TableRow {
  const bg = shade ? LGRAY : WHITE
  return new TableRow({
    children: [
      new TableCell({
        width: { size: L_COL, type: WidthType.DXA },
        shading: { fill: MGRAY, type: ShadingType.CLEAR, color: 'auto' },
        borders: allThin,
        children: [new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: label, bold: true, size: 18, font: 'Arial', color: '333333' })] })],
      }),
      new TableCell({
        width: { size: V_COL, type: WidthType.DXA },
        shading: { fill: bg, type: ShadingType.CLEAR, color: 'auto' },
        borders: allThin,
        children: [new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: value || '—', size: 20, font: 'Arial' })] })],
      }),
    ],
  })
}

function tblHeaderRow(cols: string[], widths?: number[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) => new TableCell({
      width: widths ? { size: widths[i], type: WidthType.DXA } : { size: Math.floor(W / cols.length), type: WidthType.DXA },
      shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: { style: BorderStyle.SINGLE, size: 4, color: '2a4a6b' } },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: c, bold: true, size: 16, color: WHITE, font: 'Arial' })] })],
    })),
  })
}

function tblDataRowWidths(cells: string[], widths: number[], shade = false): TableRow {
  const bg = shade ? LGRAY : WHITE
  return new TableRow({
    children: cells.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: bg, type: ShadingType.CLEAR, color: 'auto' },
      borders: allThin,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 50, after: 50 }, children: [new TextRun({ text: c || '—', size: 18, font: 'Arial' })] })],
    })),
  })
}

function simpleTable(rows: TableRow[]): Table {
  return new Table({ width: { size: W, type: WidthType.DXA }, rows })
}

function propCardHeader(title: string, badge = ''): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD } },
    children: [
      new TextRun({ text: title, bold: true, size: 22, font: 'Arial' }),
      ...(badge ? [new TextRun({ text: `  ${badge}`, size: 22, font: 'Arial', color: GOLD })] : []),
    ],
  })
}

// ── POST handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      subject, comps = [], leaseComps = [], leaseAvails = [], avails = [],
      analytics, aiText, includeLeaseComps, includeAvails, includeMarketingStrategy,
      photoUrls = {},
    } = await req.json()

    if (!subject) return NextResponse.json({ error: 'No subject property' }, { status: 400 })

    const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
    const isLease  = subject.opvType === 'lease'
    const isInvest = subject.opvType === 'investment'

    // ── Resolve photos ─────────────────────────────────────────────────────
    // photoUrls keys: 'subject' for subject prop, raw UUID for comps/avails
    const getPhoto = async (key: string): Promise<Buffer | null> => {
      const src = photoUrls[key]
      if (!src) return null
      return fetchImg(src)
    }

    const [subjectBuf, jasonBuf, jeffBuf, desmondBuf] = await Promise.all([
      getPhoto('subject'),
      Promise.resolve(loadPublicFile('team/jason.jpg') || loadPublicFile('jason.png') || loadPublicFile('jason.jpg')),
      Promise.resolve(loadPublicFile('team/jeff.jpg')  || loadPublicFile('jeff.png')  || loadPublicFile('jeff.jpg')),
      Promise.resolve(loadPublicFile('team/desmond.jpg') || loadPublicFile('desmond.png') || loadPublicFile('desmond.jpg')),
    ])

    const compBufs: Record<string, Buffer|null> = {}
    const availBufs: Record<string, Buffer|null> = {}
    const leaseCompBufs: Record<string, Buffer|null> = {}
    const leaseAvailBufs: Record<string, Buffer|null> = {}
    await Promise.all([
      ...comps.map(async (c: any) => { compBufs[c.id] = await getPhoto(c.id) }),
      ...avails.map(async (a: any) => { availBufs[a.id] = await getPhoto(a.id) }),
      ...leaseComps.map(async (c: any) => { leaseCompBufs[c.id] = await getPhoto(c.id) }),
      ...leaseAvails.map(async (a: any) => { leaseAvailBufs[a.id] = await getPhoto(a.id) }),
    ])

    // ── Computed values ────────────────────────────────────────────────────
    const bldgSF   = subject.size ? Number(subject.size) : 0
    const salePSFs = comps.map((c: any) => {
      if (c.price_per_sf) return Number(c.price_per_sf)
      if (c.sale_price && c.building_sf) return Number(c.sale_price) / Number(c.building_sf)
      return 0
    }).filter((p: number) => p > 0)
    const avgPsf    = salePSFs.length ? salePSFs.reduce((a: number, b: number) => a + b, 0) / salePSFs.length : 0
    const valLowPsf = analytics?.valueLow  && bldgSF ? analytics.valueLow  / bldgSF : 0
    const valHighPsf = analytics?.valueHigh && bldgSF ? analytics.valueHigh / bldgSF : 0

    // ── Build document children ────────────────────────────────────────────
    const children: any[] = []

    // ══════════════════════════════════════════════════════════════════════
    // COVER PAGE
    // ══════════════════════════════════════════════════════════════════════
    children.push(
      center('"Complex Issues – Simple Solutions"', 18, false, '555555'),
      spacer(),
      center('PREMIER COMMERCIAL REAL ESTATE', 40, true, '1a1a1a'),
      spacer(),
      center('──────────────────────────────────────', 14, false, GOLD),
      spacer(),
      center('OPINION OF VALUE', 52, true, '1a1a1a'),
    )
    if (isLease) children.push(center('FOR LEASE', 28, true, GOLD))
    children.push(
      spacer(),
      center('Date Prepared', 16, false, 'AAAAAA'),
      center(today, 24, true),
      spacer(),
      center('Property Address', 16, false, 'AAAAAA'),
      center(subject.address?.toUpperCase() || '—', 36, true),
    )
    if (subject.city) children.push(center(`${subject.city.toUpperCase()}, NEW YORK`, 22, false, '444444'))
    children.push(spacer(), photoPara(subjectBuf, 500, 300))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 }, children: [new TextRun({ text: `Property Photo  ·  ${subject.address}${subject.city ? ', '+subject.city : ''}`, size: 16, italics: true, color: 'AAAAAA', font: 'Arial' })] }))

    // Broker cards (3-col table, text only)
    children.push(new Table({
      width: { size: W, type: WidthType.DXA },
      rows: [new TableRow({ children: [
        ['Jason Miller','Managing Principal','516.413.1690','Jmiller@pcrellc.com'],
        ['JB (Jeff) Schwartzberg','Managing Principal','516.857.8013','Jbs@pcrellc.com'],
        ['Desmond Mullins','Partner, Executive Director','631.398.5654','Dmullins@pcrellc.com'],
      ].map(([name, title, phone, email], i) => new TableCell({
        width: { size: Math.floor(W/3), type: WidthType.DXA },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: i < 2 ? thinBorder : noBorder },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 10 }, children: [new TextRun({ text: name, bold: true, size: 20, font: 'Arial' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 10 }, children: [new TextRun({ text: title, size: 17, color: '555555', font: 'Arial' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 10 }, children: [new TextRun({ text: phone, size: 17, color: '555555', font: 'Arial' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 40 }, children: [new TextRun({ text: email, size: 17, color: '555555', font: 'Arial' })] }),
        ],
      })) })]
    }))
    children.push(spacer())
    children.push(center('Premier Commercial Real Estate, LLC  |  500 N. Broadway, Suite 105, Jericho, NY 11753', 17, false, '666666'))
    children.push(center('Main: 516.284.8000  |  www.pcrellc.com', 17, false, '666666'))

    // ══════════════════════════════════════════════════════════════════════
    // TABLE OF CONTENTS
    // ══════════════════════════════════════════════════════════════════════
    children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(center('TABLE OF CONTENTS', 28, true))
    children.push(spacer())

    const tocEntries_: string[] = [
      'I.  EXECUTIVE SUMMARY',
      'II.  BUILDING DESCRIPTION',
      'III.  OPINION OF VALUE',
      ...(isLease
        ? [
            ...(includeLeaseComps && leaseComps.length > 0 ? ['IV.  RECENT LEASE TRANSACTIONS'] : []),
            ...(comps.length > 0 ? ['V.  SUPPORTING SALE MARKET DATA'] : []),
          ]
        : [
            ...(comps.length > 0 ? [`IV.  RECENT ${isInvest ? 'INVESTMENT' : 'SALE'} TRANSACTIONS`] : []),
            ...(includeLeaseComps && leaseComps.length > 0 ? ['V.  RECENT LEASE TRANSACTIONS'] : []),
          ]
      ),
      ...(includeAvails && (isLease ? leaseAvails.length > 0 : avails.length > 0)
        ? [isLease ? 'VI.  LEASE MARKET AVAILABILITIES' : 'VI.  MARKET AVAILABILITIES'] : []),
      ...(includeMarketingStrategy ? ['VII.  MARKETING STRATEGY'] : []),
      'VIII.  PREMIER COMMERCIAL REAL ESTATE PROFILE',
    ]
    tocEntries_.forEach((e, i) => children.push(tocEntry(e, i + 2)))

    // ══════════════════════════════════════════════════════════════════════
    // SECTION I: EXECUTIVE SUMMARY
    // ══════════════════════════════════════════════════════════════════════
    children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(heading('I.  EXECUTIVE SUMMARY'))

    const execRows: [string,string][] = [
      ['PURPOSE OF OPINION:', isInvest ? 'DETERMINE CURRENT MARKET VALUE AS AN INVESTMENT SALE' : isLease ? 'DETERMINE CURRENT MARKET RENTAL RATE' : 'DETERMINE CURRENT MARKET VALUE FOR SALE'],
      ['DATE OF OPINION:', today],
      ['ADDRESS:', `${subject.address}${subject.city ? ', '+subject.city.toUpperCase()+', NEW YORK' : ''}`.toUpperCase()],
      ['COUNTY:', (subject.county || '—').toUpperCase()],
      ...(subject.municipality ? [['MUNICIPALITY:', subject.municipality] as [string,string]] : []),
      ...(subject.parcelId ? [['PARCEL ID:', subject.parcelId] as [string,string]] : []),
    ]
    children.push(simpleTable(execRows.map(([l,v], i) => labelRow(l, v, i%2===1))))
    children.push(spacer())

    children.push(subhead('PROPERTY SUMMARY HIGHLIGHTS AND ASSUMPTIONS:'))
    const highlights = [
      subject.size ? `The building is approximately ${Number(subject.size).toLocaleString()} sq. ft. in total.` : null,
      subject.ceiling ? `Ceiling height of ${subject.ceiling}' clear.` : null,
      (subject.docks || subject.driveIn) ? `${subject.docks || '—'} loading dock(s) and ${subject.driveIn || '—'} drive-in door(s).` : null,
      subject.sprinkler ? `${subject.sprinkler} sprinkler system.` : null,
      subject.sewer ? `Sewer: ${subject.sewer}.` : null,
      subject.power ? `Electrical service: ${subject.power}.` : null,
      subject.taxes ? `Real Estate Taxes are $${Number(subject.taxes).toLocaleString()} or approximately $${subject.size ? (Number(subject.taxes)/Number(subject.size)).toFixed(2) : '—'} PSF.` : null,
      subject.lot ? `The building sits on a parcel of approximately ${subject.lot} acres.` : null,
      subject.notes || null,
    ].filter(Boolean) as string[]
    highlights.forEach(h => children.push(bullet(h)))

    children.push(subhead('HIGHEST AND BEST USE:'))
    const hbu = subject.highestBestUse
      ? String(subject.highestBestUse).split('\n').filter(Boolean).map((u: string) => u.trim())
      : ['Manufacturing', 'Wholesale Operation', 'Warehouse / Distribution']
    hbu.forEach((u: string) => children.push(bullet(u)))

    // ══════════════════════════════════════════════════════════════════════
    // SECTION II: BUILDING DESCRIPTION
    // ══════════════════════════════════════════════════════════════════════
    children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(heading('II.  BUILDING DESCRIPTION'))

    type LR3 = [string,string,boolean]
    const descRows: LR3[] = [
      ['PROPERTY ADDRESS', `${subject.address}${subject.city ? ', '+subject.city : ''}`, false],
      ['TOTAL BUILDING SF', subject.size ? `${Number(subject.size).toLocaleString()} SF` : '—', true],
      ...(subject.officePct ? [['OFFICE', `${subject.officePct}%`, false] as LR3] : []),
      ['TOTAL SITE ACREAGE', subject.lot ? `${subject.lot} AC` : '—', !subject.officePct as boolean],
      ['CEILING HEIGHT', subject.ceiling ? `${subject.ceiling}' clear` : '—', !!subject.officePct as boolean],
      ['DRIVE-IN DOORS', str(subject.driveIn), !subject.officePct as boolean],
      ['LOADING DOCKS', str(subject.docks), true],
      ['HEAT', str(subject.heat), false],
      ['POWER', str(subject.power), true],
      ['PARKING', str(subject.parking), false],
      ['SPRINKLER SYSTEM', str(subject.sprinkler), true],
      ['SEWER CONNECTION', str(subject.sewer), false],
      ['ZONING', str(subject.zoning), true],
      ['REAL ESTATE TAXES', subject.taxes ? `$${Number(subject.taxes).toLocaleString()}/yr${subject.size ? ` / $${(Number(subject.taxes)/Number(subject.size)).toFixed(2)} PSF` : ''}` : '—', false],
      ...(subject.yearBuilt ? [['YEAR BUILT', str(subject.yearBuilt), true] as LR3] : []),
      ...(subject.construction ? [['CONSTRUCTION', str(subject.construction), false] as LR3] : []),
      ...(subject.condition ? [['CONDITION', str(subject.condition), true] as LR3] : []),
    ]
    children.push(simpleTable(descRows.map(([l,v,s]) => labelRow(l,v,s))))

    // ══════════════════════════════════════════════════════════════════════
    // SECTION III: OPINION OF VALUE
    // ══════════════════════════════════════════════════════════════════════
    children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(heading('III.  OPINION OF VALUE'))
    children.push(body('Based upon the aforementioned assumptions, our knowledge of current market conditions, and a review of the Comparables found in Section IV.'))
    children.push(spacer())

    if (isLease) {
      const leaseVal = subject.leasePsfLow && subject.leasePsfHigh
        ? `$${subject.leasePsfLow} – $${subject.leasePsfHigh} per SF per year — Modified Gross / NNN`
        : subject.leasePsfLow || subject.leasePsfHigh
        ? `$${subject.leasePsfLow || subject.leasePsfHigh} per SF per year — Modified Gross / NNN`
        : '[ $_________ per SF per year — Modified Gross / NNN ]'
      const leaseAsk = analytics?.leaseSuggested
        ? `$${analytics.leaseSuggested.toFixed(2)} per SF per year — Modified Gross / NNN`
        : subject.leasePsfHigh
        ? `$${subject.leasePsfHigh} per SF per year — Modified Gross / NNN`
        : '[ $_________ per SF per year — Modified Gross / NNN ]'
      children.push(simpleTable([
        new TableRow({ children: [
          new TableCell({ width: { size: 3000, type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' }, borders: allNone, children: [new Paragraph({ spacing: { before: 100, after: 100 }, children: [new TextRun({ text: 'ESTIMATED VALUE FOR LEASE', bold: true, size: 20, color: WHITE, font: 'Arial' })] })] }),
          new TableCell({ width: { size: W-3000, type: WidthType.DXA }, shading: { fill: 'FFF8E1', type: ShadingType.CLEAR, color: 'auto' }, borders: allThin, children: [new Paragraph({ spacing: { before: 100, after: 100 }, children: [new TextRun({ text: leaseVal, bold: true, size: 28, color: GOLD, font: 'Arial' })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: 3000, type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' }, borders: allNone, children: [new Paragraph({ spacing: { before: 100, after: 100 }, children: [new TextRun({ text: 'RECOMMENDED ASKING LEASE PRICE', bold: true, size: 20, color: WHITE, font: 'Arial' })] })] }),
          new TableCell({ width: { size: W-3000, type: WidthType.DXA }, shading: { fill: 'FFF8E1', type: ShadingType.CLEAR, color: 'auto' }, borders: allThin, children: [new Paragraph({ spacing: { before: 100, after: 100 }, children: [new TextRun({ text: leaseAsk, bold: true, size: 28, color: GOLD, font: 'Arial' })] })] }),
        ]}),
      ]))
    } else {
      const psfVal  = valLowPsf && valHighPsf ? `$${valLowPsf.toFixed(2)} – $${valHighPsf.toFixed(2)}` : avgPsf ? `$${avgPsf.toFixed(2)}` : '[ __________ ]'
      const totVal  = valLowPsf && valHighPsf && bldgSF
        ? `$${Math.round(valLowPsf*bldgSF).toLocaleString()} – $${Math.round(valHighPsf*bldgSF).toLocaleString()}`
        : bldgSF && avgPsf ? `$${Math.round(bldgSF*avgPsf).toLocaleString()}` : '[ __________ ]'
      const col = Math.floor(W / 3)
      children.push(simpleTable([
        new TableRow({ children: [
          new TableCell({ width: { size: col, type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' }, borders: allNone, children: [new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: 'Estimated Value For Sale', bold: true, size: 18, color: WHITE, font: 'Arial' })] })] }),
          new TableCell({ width: { size: col, type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' }, borders: allNone, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [new TextRun({ text: 'Per SF', bold: true, size: 18, color: WHITE, font: 'Arial' })] })] }),
          new TableCell({ width: { size: col, type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' }, borders: allNone, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [new TextRun({ text: 'Total', bold: true, size: 18, color: WHITE, font: 'Arial' })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: col, type: WidthType.DXA }, shading: { fill: MGRAY, type: ShadingType.CLEAR, color: 'auto' }, borders: allThin, children: [new Paragraph({ text: '', spacing: { before: 100, after: 100 } })] }),
          new TableCell({ width: { size: col, type: WidthType.DXA }, shading: { fill: 'FFF8E1', type: ShadingType.CLEAR, color: 'auto' }, borders: allThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 }, children: [new TextRun({ text: psfVal, bold: true, size: 32, color: GOLD, font: 'Arial' })] })] }),
          new TableCell({ width: { size: col, type: WidthType.DXA }, shading: { fill: 'FFF8E1', type: ShadingType.CLEAR, color: 'auto' }, borders: allThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 }, children: [new TextRun({ text: totVal, bold: true, size: 32, color: GOLD, font: 'Arial' })] })] }),
        ]}),
      ]))
      if (isInvest || subject.capRateLow) {
        children.push(spacer())
        children.push(body('The value shall be established as a function of:'))
        children.push(bullet('A "Fair Market" Rental Rate for an acceptable lease term.'))
        children.push(bullet('An acceptable Rate of Return (Cap Rate) to the investor/Purchaser.'))
        if (subject.leasePsfLow || subject.leasePsfHigh) children.push(simpleTable([labelRow('Lease/Rental Rate (Year 1)', `$${subject.leasePsfLow} to $${subject.leasePsfHigh} PSF NNN`)]))
        if (subject.capRateLow || subject.capRateHigh) children.push(simpleTable([labelRow('Cap Rate', `${subject.capRateLow}% to ${subject.capRateHigh}%`)]))
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // SALE COMP SECTION (reusable)
    // ══════════════════════════════════════════════════════════════════════
    const pushSaleComps = (secNum: string, title: string, supporting = false) => {
      if (!comps.length) return
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(heading(`${secNum}.  ${title}`))
      if (supporting) children.push(body('The following sale transactions are provided as supporting market context.', true))

      const sW = [Math.floor(W*0.32), Math.floor(W*0.18), Math.floor(W*0.18), Math.floor(W*0.18), Math.floor(W*0.14)]
      children.push(simpleTable([
        tblHeaderRow(['Property Address','City','Building Size (SF)','Sale Price','Price PSF'], sW),
        ...comps.map((c: any, i: number) => {
          const psf = c.price_per_sf || (c.sale_price && c.building_sf ? Number(c.sale_price)/Number(c.building_sf) : 0)
          return tblDataRowWidths([
            str(c.address), str(c.city),
            c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—',
            c.sale_price ? `$${Number(c.sale_price).toLocaleString()}` : '—',
            psf ? `$${Number(psf).toFixed(2)}` : '—',
          ], sW, i%2===1)
        }),
      ]))
      children.push(body('Each comparable transaction is detailed on the following pages.', true))

      for (const [i, c] of comps.entries()) {
        const psf = c.price_per_sf || (c.sale_price && c.building_sf ? Number(c.sale_price)/Number(c.building_sf) : 0)
        children.push(propCardHeader(
          `COMPARABLE ${i+1}  —  ${(c.address||'').toUpperCase()}${c.city ? ', '+c.city.toUpperCase() : ''}`,
          psf ? `$${Number(psf).toFixed(2)}/SF` : ''
        ))
        children.push(photoPara(compBufs[c.id], 500, 260))
        const rows: LR3[] = [
          ['PROPERTY ADDRESS', `${str(c.address)}${c.city ? ', '+c.city : ''}`, false],
          ['BUILDING SIZE', c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—', true],
          ['LOT SIZE', c.lot_size_ac ? `${c.lot_size_ac} Acres` : '—', false],
          ['CEILING HEIGHT', c.ceiling_height ? `${c.ceiling_height} ft` : '—', true],
          ['LOADING DOCKS', str(c.loading_docks), false],
          ['DRIVE INS', str(c.drive_ins), true],
          ['POWER', str(c.power), false],
          ['SEWERS', str(c.sewer), true],
          ['HEAT', str(c.heat), false],
          ['ZONING', str(c.zoning), true],
          ['SPRINKLERS', str(c.sprinkler), false],
          ['PARKING', str(c.parking), true],
          ['REAL ESTATE TAXES', str(c.re_taxes), false],
          ['SALE PRICE', `${c.sale_price ? '$'+Number(c.sale_price).toLocaleString() : '—'}${psf ? ` ($${Number(psf).toFixed(2)} PSF)` : ''}`, true],
          ['TRANSACTION DATE', fmtDate(c.sale_date), false],
          ['BUYER', str(c.buyer), true],
          ['SELLER', str(c.seller), false],
        ]
        children.push(simpleTable(rows.map(([l,v,s]) => labelRow(l,v,s))))
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // LEASE COMP SECTION (reusable)
    // ══════════════════════════════════════════════════════════════════════
    const pushLeaseComps = (secNum: string, title: string) => {
      if (!includeLeaseComps || !leaseComps.length) return
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(heading(`${secNum}.  ${title}`))

      const lcW = [Math.floor(W*0.30), Math.floor(W*0.18), Math.floor(W*0.18), Math.floor(W*0.22), Math.floor(W*0.12)]
      children.push(simpleTable([
        tblHeaderRow(['Property Address','Town','Building Size (SF)','Rent PSF (Type)','Term (yrs)'], lcW),
        ...leaseComps.map((c: any, i: number) => tblDataRowWidths([
          str(c.address), str(c.town),
          c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—',
          c.deal_rent ? `$${Number(c.deal_rent).toFixed(2)}${c.rent_type ? ' ('+c.rent_type+')' : ''}` : c.asking_rent ? `$${Number(c.asking_rent).toFixed(2)} (Ask)` : '—',
          c.lease_term_years ? String(c.lease_term_years) : '—',
        ], lcW, i%2===1)),
      ]))
      children.push(body('Each lease comparable is detailed on the following pages.', true))

      for (const [i, c] of leaseComps.entries()) {
        children.push(propCardHeader(
          `LEASE COMPARABLE ${i+1}  —  ${(c.address||'').toUpperCase()}${c.town ? ', '+c.town.toUpperCase() : ''}`,
          c.deal_rent ? `$${Number(c.deal_rent).toFixed(2)}/SF/yr` : ''
        ))
        children.push(photoPara(leaseCompBufs[c.id], 500, 260))
        const rows: LR3[] = [
          ['PROPERTY ADDRESS', `${str(c.address)}${c.town ? ', '+c.town : ''}`, false],
          ...(c.property_type ? [['PROPERTY TYPE', str(c.property_type), true] as LR3] : []),
          ['BUILDING SIZE', c.building_sf ? `${Number(c.building_sf).toLocaleString()} SF` : '—', !c.property_type as boolean],
          ['LOT SIZE', c.lot_size_ac ? `${c.lot_size_ac} Acres` : '—', false],
          ['OFFICE SIZE', c.office_sf ? `${Number(c.office_sf).toLocaleString()} SF` : '—', true],
          ['LOADING', c.loading_docks && c.drive_ins ? `${c.loading_docks} Docks / ${c.drive_ins} Drive-In` : c.loading_docks ? `${c.loading_docks} Docks` : c.drive_ins ? `${c.drive_ins} Drive-In` : '—', false],
          ['CEILING HEIGHT', c.ceiling_height ? `${c.ceiling_height} ft` : '—', true],
          ['POWER', str(c.power), false],
          ['HEAT', str(c.heat), true],
          ['SPRINKLERS', str(c.sprinkler), false],
          ['PARKING', str(c.parking), true],
          ['SEWER', str(c.sewer), false],
          ['ZONING', str(c.zoning), true],
          ['RE TAXES', c.re_taxes ? `$${Number(c.re_taxes).toLocaleString()}/yr` : '—', false],
          ['LEASE PRICE', c.deal_rent ? `$${Number(c.deal_rent).toFixed(2)} PSF/yr${c.rent_type ? ' — '+c.rent_type : ''}` : c.asking_rent ? `$${Number(c.asking_rent).toFixed(2)} PSF/yr (Ask)` : '—', true],
          ['TAXES', c.taxes ? `$${Number(c.taxes).toFixed(2)}/SF` : '—', false],
          ['TERM', c.lease_term_years ? `${c.lease_term_years} years` : '—', true],
          ['ESCALATIONS', str(c.escalations), false],
          ['CONCESSION', c.rent_concession_months ? `${c.rent_concession_months} months` : '—', true],
          ['LANDLORD WORK', str(c.ti_ll_work), false],
          ['TENANT NAME', str(c.tenant), true],
          ['LANDLORD NAME', str(c.landlord), false],
          ['TRANSACTION DATE', fmtDate(c.transaction_date), true],
          ...(c.notes ? [['ADDITIONAL COMMENTS', str(c.notes), false] as LR3] : []),
        ]
        children.push(simpleTable(rows.map(([l,v,s]) => labelRow(l,v,s))))
      }
    }

    // Push in correct order
    if (!isLease) {
      pushSaleComps('IV', `RECENT ${isInvest ? 'INVESTMENT' : 'SALE'} TRANSACTIONS`, false)
      pushLeaseComps('V', 'RECENT LEASE TRANSACTIONS')
    } else {
      pushLeaseComps('IV', 'RECENT LEASE TRANSACTIONS')
      pushSaleComps('V', 'SUPPORTING SALE MARKET DATA', true)
    }

    // ══════════════════════════════════════════════════════════════════════
    // SECTION VI: MARKET AVAILABILITIES
    // ══════════════════════════════════════════════════════════════════════
    if (includeAvails) {
      if (isLease && leaseAvails.length > 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }))
        children.push(heading('VI.  LEASE MARKET AVAILABILITIES'))
        children.push(body('Active lease listings in the market for comparison.', true))

        const laW = [Math.floor(W*0.27), Math.floor(W*0.15), Math.floor(W*0.15), Math.floor(W*0.13), Math.floor(W*0.17), Math.floor(W*0.13)]
        children.push(simpleTable([
          tblHeaderRow(['Property Address','Town','Bldg SF','Ceiling','Asking Rent','Rent Type'], laW),
          ...leaseAvails.map((a: any, i: number) => tblDataRowWidths([
            str(a.address), str(a.town),
            a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—',
            a.ceiling_height ? `${a.ceiling_height} ft` : '—',
            a.asking_rent ? `$${Number(a.asking_rent).toFixed(2)}/SF/yr` : '—',
            str(a.rent_type),
          ], laW, i%2===1)),
        ]))
        children.push(body('Each availability is detailed on the following pages.', true))

        for (const [i, a] of leaseAvails.entries()) {
          children.push(propCardHeader(
            `AVAILABILITY ${i+1}  —  ${(a.address||'').toUpperCase()}${a.town ? ', '+a.town.toUpperCase() : ''}`,
            a.asking_rent ? `$${Number(a.asking_rent).toFixed(2)}/SF/yr` : ''
          ))
          children.push(photoPara(leaseAvailBufs[a.id], 500, 260))
          const rows: LR3[] = [
            ['PROPERTY ADDRESS', `${str(a.address)}${a.town ? ', '+a.town : ''}`, false],
            ...(a.property_type ? [['PROPERTY TYPE', str(a.property_type), true] as LR3] : []),
            ['BUILDING SIZE', a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—', !a.property_type as boolean],
            ['LOT SIZE', a.lot_size_ac ? `${a.lot_size_ac} Acres` : '—', false],
            ['CEILING HEIGHT', a.ceiling_height ? `${a.ceiling_height} ft` : '—', true],
            ['LOADING DOCKS', str(a.loading_docks), false],
            ['DRIVE-INS', str(a.drive_ins), true],
            ['POWER', str(a.power), false],
            ['HEAT', str(a.heat), true],
            ['SPRINKLERS', str(a.sprinkler), false],
            ['PARKING', str(a.parking), true],
            ['SEWER', str(a.sewer), false],
            ['ZONING', str(a.zoning), true],
            ...(a.re_taxes ? [['RE TAXES', `$${Number(a.re_taxes).toLocaleString()}/yr`, false] as LR3] : []),
            ['ASKING RENT', a.asking_rent ? `$${Number(a.asking_rent).toFixed(2)}/SF/yr` : '—', true],
            ['RENT TYPE', str(a.rent_type), false],
            ['TAXES', a.taxes ? `$${Number(a.taxes).toFixed(2)}/SF` : '—', true],
            ['LANDLORD', str(a.landlord), false],
            ...(a.notes ? [['NOTES', str(a.notes), true] as LR3] : []),
          ]
          children.push(simpleTable(rows.map(([l,v,s]) => labelRow(l,v,s))))
        }
      } else if (!isLease && avails.length > 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }))
        children.push(heading('VI.  MARKET AVAILABILITIES'))

        const avW = [Math.floor(W*0.28), Math.floor(W*0.15), Math.floor(W*0.14), Math.floor(W*0.14), Math.floor(W*0.16), Math.floor(W*0.13)]
        children.push(simpleTable([
          tblHeaderRow(['Property Address','City','Bldg SF','Lot Size','Asking Price','Price PSF'], avW),
          ...avails.map((a: any, i: number) => {
            const psf = a.price_per_sf || (a.asking_price && a.building_sf ? Number(a.asking_price)/Number(a.building_sf) : 0)
            return tblDataRowWidths([
              str(a.address), str(a.city),
              a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—',
              a.lot_size_ac ? `${a.lot_size_ac} AC` : '—',
              a.asking_price ? `$${Number(a.asking_price).toLocaleString()}` : '—',
              psf ? `$${Number(psf).toFixed(2)}` : '—',
            ], avW, i%2===1)
          }),
        ]))
        children.push(body('Each market availability is detailed on the following pages.', true))

        for (const [i, a] of avails.entries()) {
          const psf = a.price_per_sf || (a.asking_price && a.building_sf ? Number(a.asking_price)/Number(a.building_sf) : 0)
          children.push(propCardHeader(
            `AVAILABILITY ${i+1}  —  ${(a.address||'').toUpperCase()}${a.city ? ', '+a.city.toUpperCase() : ''}`,
            psf ? `$${Number(psf).toFixed(2)}/SF` : ''
          ))
          children.push(photoPara(availBufs[a.id], 500, 260))
          const rows: LR3[] = [
            ['PROPERTY ADDRESS', `${str(a.address)}${a.city ? ', '+a.city : ''}`, false],
            ...(a.property_type ? [['PROPERTY TYPE', str(a.property_type), true] as LR3] : []),
            ['BUILDING SIZE', a.building_sf ? `${Number(a.building_sf).toLocaleString()} SF` : '—', !a.property_type as boolean],
            ['LOT SIZE', a.lot_size_ac ? `${a.lot_size_ac} Acres` : '—', false],
            ['CEILING HEIGHT', a.ceiling_height ? `${a.ceiling_height} ft` : '—', true],
            ['LOADING DOCKS', str(a.loading_docks), false],
            ['DRIVE INS', str(a.drive_ins), true],
            ['POWER', str(a.power), false],
            ['SEWERS', str(a.sewer), true],
            ['HEAT', str(a.heat), false],
            ['ZONING', str(a.zoning), true],
            ['SPRINKLERS', str(a.sprinkler), false],
            ['PARKING', str(a.parking), true],
            ['ASKING PRICE', a.asking_price ? `$${Number(a.asking_price).toLocaleString()}` : '—', false],
            ['ASKING $/SF', psf ? `$${Number(psf).toFixed(2)} PSF` : '—', true],
            ['PRICING GUIDANCE', str(a.pricing_guidance), false],
            ['REAL ESTATE TAXES', str(a.re_taxes), true],
          ]
          children.push(simpleTable(rows.map(([l,v,s]) => labelRow(l,v,s))))
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // AI TEXT / MARKET COMMENTARY
    // ══════════════════════════════════════════════════════════════════════
    if (aiText) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(heading('MARKET COMMENTARY & BROKER ANALYSIS'))
      String(aiText).split('\n').forEach((line: string) => {
        children.push(new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: line, size: 20, font: 'Arial' })] }))
      })
    }

    // ══════════════════════════════════════════════════════════════════════
    // SECTION VII: MARKETING STRATEGY
    // ══════════════════════════════════════════════════════════════════════
    if (includeMarketingStrategy) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(heading('VII.  MARKETING STRATEGY'))
      children.push(subhead('FOCUSED DEDICATION / HARD WORK… TO INCLUDE:'))
      children.push(bullet('PREMIER COMMERCIAL REAL ESTATE will prepare electronic marketing material and meet with selected "Highly qualified" buyers.'))
      children.push(bullet('PREMIER COMMERCIAL REAL ESTATE will distribute e-Blast marketing flyers to the local brokerage community (including the outer NYC Boroughs).'))
      children.push(bullet('PREMIER COMMERCIAL REAL ESTATE will prepare all proposals and respond to proposals submitted by prospective purchasers after receiving authorization from ownership.'))
      children.push(bullet('PREMIER COMMERCIAL REAL ESTATE will conduct all site inspections and conduct marketing presentations for purchasers.'))
      children.push(bullet('PREMIER COMMERCIAL REAL ESTATE will implement and follow up on a direct marketing program including: Identification of qualified prospects; Mailings (electronic and regular) to prospective Investors; Regular follow-up phone canvassing; Regular follow-up "in-person" canvassing; and Follow-up correspondence.'))
      children.push(subhead('HOW DOES PARTNERING WITH PREMIER DIFFER FROM "THE CROWD"?'))
      children.push(bullet('We always maintain a "Client First" philosophy.'))
      children.push(bullet('We view our clients as "Partners" – our economic interests are precisely aligned.'))
      children.push(bullet('Industrial leasing & sales are all that we do.'))
      children.push(bullet('Our market knowledge is "top in the business" which will serve us to maximize value.'))
      children.push(bullet('Combined over 40 years experience – specializing in Industrial Properties (Total Sales Transactions exceed $500 Million).'))
      children.push(bullet('In 2020 we brokered the largest industrial sales transactions in both Suffolk and Nassau counties ($35.5 Million and $33 Million respectively).'))
      children.push(bullet('We have built strong relationships with highly qualified purchasers and investors over several decades.'))
      children.push(bullet('We are recognized as "leaders" within the commercial brokerage community.'))
    }

    // ══════════════════════════════════════════════════════════════════════
    // SECTION VIII: PCRE PROFILE
    // ══════════════════════════════════════════════════════════════════════
    children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(heading('VIII.  PREMIER COMMERCIAL REAL ESTATE PROFILE'))
    children.push(body('Premier Commercial Real Estate, LLC is a full-service commercial real estate service provider offering personalized and strategic solutions for investors, property owners, tenants and diverse businesses. With a laser-sharp focus on, and in-depth knowledge of the Long Island market, Premier\'s seasoned professionals work together as a team to identify the best real estate opportunities for its clients.'))
    children.push(body('From property sales and leasing to tax-advantaged 1031 exchanges and portfolio development, Premier applies the full force of its experience, know-how and network to effectively achieve the real estate goals of its clients.'))
    children.push(spacer())

    const salesW = [Math.floor(W*0.24), Math.floor(W*0.14), Math.floor(W*0.14), Math.floor(W*0.16), Math.floor(W*0.16), Math.floor(W*0.16)]
    children.push(subhead("PCRE'S SAMPLE OF OUR RECENTLY COMPLETED SALES TRANSACTIONS"))
    children.push(simpleTable([
      tblHeaderRow(['Property Address','City','Property Type','Building Size (SF)','Sale Price','Transaction Date'], salesW),
      ...FALLBACK_SALES.map((row, i) => tblDataRowWidths(row, salesW, i%2===1)),
    ]))
    children.push(spacer())
    children.push(subhead("PCRE'S SAMPLE OF OUR RECENTLY COMPLETED LEASE TRANSACTIONS"))
    children.push(simpleTable([
      tblHeaderRow(['Property Address','City','Tenant','Leased SF','Lease Price (PSF)','Transaction Date'], salesW),
      ...FALLBACK_LEASES.map((row, i) => tblDataRowWidths(row, salesW, i%2===1)),
    ]))
    children.push(spacer())

    // ══════════════════════════════════════════════════════════════════════
    // BROKER BIOS
    // ══════════════════════════════════════════════════════════════════════
    children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(subhead('ABOUT THE BROKERS'))
    children.push(spacer())

    const pushBio = (name: string, title: string, photoBuf: Buffer|null, paras: string[]) => {
      const photoImg = photoBuf ? makeImgRun(photoBuf, 110, 140) : null
      children.push(new Table({
        width: { size: W, type: WidthType.DXA },
        rows: [new TableRow({
          children: [
            new TableCell({
              width: { size: 1600, type: WidthType.DXA },
              borders: allNone,
              children: [
                photoImg
                  ? new Paragraph({ children: [photoImg], spacing: { before: 0, after: 0 } })
                  : new Paragraph({ text: '', spacing: { before: 0, after: 0 } }),
              ],
            }),
            new TableCell({
              width: { size: W-1600, type: WidthType.DXA },
              borders: allNone,
              children: [
                new Paragraph({ spacing: { before: 0, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD } }, children: [new TextRun({ text: name, bold: true, size: 28, font: 'Arial' })] }),
                new Paragraph({ spacing: { before: 40, after: 120 }, children: [new TextRun({ text: title, size: 20, italics: true, color: '555555', font: 'Arial' })] }),
                ...paras.map(p => new Paragraph({ spacing: { before: 40, after: 60 }, children: [new TextRun({ text: p, size: 18, font: 'Arial' })] })),
              ],
            }),
          ],
        })],
      }))
      children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'EEEEEE' } }, text: '', spacing: { before: 60, after: 120 } }))
    }

    pushBio('JASON D. MILLER', 'Managing Principal', jasonBuf, [
      'Jason Miller is Co-Founder and Managing Principal at Premier Commercial Real Estate with over 17 years experience, and is widely recognized as one of Long Island\'s top commercial real estate professionals. During his career, Mr. Miller has represented a substantial number of satisfied clients and customers, successfully completing an extraordinary number of sales and leasing transactions, totaling several million square feet of space.',
      'Mr. Miller began his real estate career as a Sales Associate at Sutton & Edwards Inc (now Colliers International, LI Inc.) and was quickly promoted to the position of Senior Director, Industrial Properties for Long Island. After a number of successful years there, Mr. Miller felt the structure and rigid policies of the larger national real estate brokerage firm limited his ability to provide the "timely and responsive" flexibility that his customers and clients demanded. So, in October of 2013, along with his partner Jeff Schwartzberg, he created Premier Commercial Real Estate, a brokerage firm strictly focused on delivering ultimate customer service.',
      'Since Premier\'s inception, Jason and his company have received a number of the industry\'s top awards. Some examples include: In 2015 Premier was recognized by LIBN as "commercial brokerage company of the year"; Premier was awarded top honors in 2015 for completing the largest industrial sale transactions in both Nassau County and Suffolk County; In 2016 Premier received yet another award for completing Nassau County\'s largest industrial sales transaction; In 2016 Jason was chosen from hundreds of candidates to receive LIBN\'s prestigious 40 under 40 award; and each year over the past decade, Jason has received the Co-Star Power Broker Award.',
      'Today, Mr. Miller is widely recognized as a dedicated, skilled, and highly knowledgeable real estate professional, which has resulted in him being chosen to represent some of Long Island\'s largest Landlords, properties and portfolios. He has a proven track-record representing diverse industrial properties that include Manufacturing Facilities, Distribution/Fulfillment Centers, Cold Storage, Flex/R&D Buildings, and more.',
    ])

    pushBio('JEFFREY B. SCHWARTZBERG', 'Managing Principal', jeffBuf, [
      'JB (Jeff) Schwartzberg, Co-Founder and Managing Principal at Premier Commercial Real Estate, has developed a vast background and proven track record in commercial real estate spanning over three decades. Mr. Schwartzberg brings that knowledge to Premier, leading its day-to-day business operations. He is widely recognized in the industry as one of Long Island\'s Top commercial real estate professionals.',
      'Before becoming a full time Broker, Jeff enjoyed a successful and extensive 20-year career, holding several key "senior executive" positions in the Defense Industry, with Sperry/Unisys/Loral/Lockheed Martin Corporations. This was followed by several years as a Senior Investment Officer at First Industrial Realty Trust, a Chicago based REIT, which acted as a natural springboard for his brokerage career.',
      'Immediately prior to creating Premier in 2013, Mr. Schwartzberg spent more than a decade with Colliers International, ultimately rising to the position of Senior Executive Director, Industrial Properties-Long Island. While there, he was honored with a "Person of the Year" award. He has been named a Co-Star "Power Broker" every year and has participated in industrial property sales and leases involving millions of square feet. In 2023, Jeff received Long Island Business News\' most prestigious award "Top Commercial Broker on Long Island."',
      'Mr. Schwartzberg was a long-time member of the Board of Directors of Long Island\'s Commercial Industrial Brokers Society (CIBS) and served eight years on its executive board, ultimately becoming its President. He had also earned membership into the Society of Industrial and Office Realtors (SIOR). One of Mr. Schwartzberg\'s additional noteworthy accomplishments is his having earned status as a certified NYS instructor of continuing education for real estate professionals.',
      'Community-minded, he served for 14 years as a Village Official in the Village of Roslyn Estates, ultimately being elected for 3 consecutive terms as Village Mayor. Jeff also served for 17 years on the Board of "Big Brothers Big Sisters of Long Island." Mr. Schwartzberg earned an undergraduate degree in Accounting from Queens College and holds an MBA in Financial Management from Iona College.',
    ])

    pushBio('DESMOND MULLINS', 'Partner, Executive Director', desmondBuf, [
      'Desmond Mullins is a seasoned commercial real estate broker, making waves in the Long Island market with an impressive track record of success. Born and raised in Hauppauge, NY, Desmond currently calls Long Beach home but operates throughout the various business parks across Nassau and Suffolk County. He specializes in landlord, tenant, seller, and buyer representation.',
      'In 2025, Desmond was promoted to Partner at Premier Commercial Real Estate, a milestone that reflects his leadership and continued impact on the firm\'s growth. That same year, he was recognized as one of LIBN\'s Emerging Leaders Under 30. His earlier accolades include LIBN\'s 30 Under 30 (2021), the CIBS Rising Star Award (2022), and leading his team to be named LIBN\'s Top Industrial Brokerage Team (2024).',
      'Desmond\'s expertise spans transactions exceeding a total value of more than $300 million. He remains an active member of CIBS (Commercial Industrial Brokers Society) and HIA (Hauppauge Industrial Association), contributing to the growth and innovation of Long Island\'s industrial market.',
      'A globetrotter by nature, Desmond travels across the United States, Europe, and South America to gain insights and global perspectives. He holds a BS in Business Administration with a concentration in entrepreneurship from the School of Management at Binghamton University.',
      'Outside the boardroom, Desmond enjoys exercising, golfing, volleyball, snowboarding, and biking. With over a decade of experience, he continues to shape the industrial real estate landscape with passion, expertise, and a commitment to excellence.',
    ])

    // ══════════════════════════════════════════════════════════════════════
    // DISCLAIMER
    // ══════════════════════════════════════════════════════════════════════
    children.push(new Paragraph({
      spacing: { before: 240, after: 60 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' } },
      children: [
        new TextRun({ text: 'DISCLAIMER: ', bold: true, size: 16, font: 'Arial', color: '999999' }),
        new TextRun({ text: 'This Opinion of Value has been prepared by Premier Commercial Real Estate for informational purposes only and does not constitute a certified appraisal. It is based upon data available at the time of preparation and may not reflect subsequent market changes. This report should not be relied upon as a substitute for a formal appraisal by a licensed appraiser.', size: 16, font: 'Arial', color: '999999' }),
      ],
    }))

    // ── Build and return document ──────────────────────────────────────────
    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
        children,
      }],
    })

    const buf = await Packer.toBuffer(doc)
    const safeName = (subject.address || 'OPV').replace(/[^a-zA-Z0-9\s]/g,'').replace(/\s+/g,'_').slice(0,40)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}_OPV.docx"`,
      },
    })
  } catch (err: any) {
    console.error('generate-docx error:', err)
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
