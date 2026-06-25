export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, HeadingLevel, TabStopType,
  TabStopPosition, LevelFormat, PageBreak
} from 'docx'
import fs from 'fs'
import path from 'path'

const GOLD = 'C9A227'
const DARK = '1A1A1A'
const GRAY_HEADER = '2D2D2D'
const LIGHT_GRAY = 'F2F2F2'
const WHITE = 'FFFFFF'
const BORDER_COLOR = 'CCCCCC'
const GOLD_BORDER = 'C9A227'

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }
const borders = { top: border, bottom: border, left: border, right: border }
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

const fmt = (n: number | string | null | undefined, prefix = '', suffix = '') =>
  n ? `${prefix}${Number(n).toLocaleString()}${suffix}` : '—'

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) } catch { return d }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sectionHeading(text: string): any {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, font: 'Arial', color: DARK })],
    spacing: { before: 200, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD_BORDER, space: 4 } },
  })
}

function subHeading(text: string): any {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color: DARK })],
    spacing: { before: 240, after: 120 },
  })
}

function body(text: string, opts: { italic?: boolean; bold?: boolean; color?: string } = {}): any {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: 'Arial', italic: opts.italic, bold: opts.bold, color: opts.color || DARK })],
    spacing: { before: 60, after: 60 },
  })
}

function spacer(): any {
  return new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 80, after: 80 } })
}

function labelValueRow(label: string, value: string): any {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 3240, type: WidthType.DXA },
        borders,
        shading: { fill: 'EBEBEB', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: 'Arial', color: DARK })] })],
      }),
      new TableCell({
        width: { size: 6120, type: WidthType.DXA },
        borders,
        margins: { top: 80, bottom: 80, left: 140, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: 18, font: 'Arial', color: DARK })] })],
      }),
    ],
  })
}

function darkHeaderRow(labels: string[], widths: number[]): any {
  return new TableRow({
    tableHeader: true,
    children: labels.map((label, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        borders,
        shading: { fill: GRAY_HEADER, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 80 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: label, bold: true, size: 18, font: 'Arial', color: WHITE })],
        })],
      })
    ),
  })
}

function dataRow(cells: string[], widths: number[], shade = false): any {
  return new TableRow({
    children: cells.map((cell, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        borders,
        shading: { fill: shade ? LIGHT_GRAY : WHITE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 80 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: cell || '—', size: 18, font: 'Arial', color: DARK })],
        })],
      })
    ),
  })
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const { subject, comps, avails, analytics } = await req.json()

  // Load logo
  const logoPath = path.join(process.cwd(), 'public', 'pcre_logo.png')
  const logoData = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null

  // Pre-fetch property photos — fall back to Street View when no photo_url
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  async function fetchPropertyPhoto(url: string | undefined, address: string | undefined): Promise<Buffer | null> {
    if (url) return fetchImageBuffer(url)
    if (!address) return null
    const svUrl = `${baseUrl}/api/street-view?address=${encodeURIComponent(address)}`
    return fetchImageBuffer(svUrl)
  }

  const compPhotos: (Buffer | null)[] = await Promise.all(
    (comps || []).map((c: Record<string,unknown>) =>
      fetchPropertyPhoto(c.photo_url as string | undefined, c.address as string | undefined)
    )
  )
  const availPhotos: (Buffer | null)[] = await Promise.all(
    (avails || []).map((a: Record<string,unknown>) =>
      fetchPropertyPhoto(a.photo_url as string | undefined, a.address as string | undefined)
    )
  )

  const logoImage = logoData ? new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: 'png', data: logoData, transformation: { width: 220, height: 54 } })],
    spacing: { after: 40 },
  }) : new Paragraph({ children: [new TextRun({ text: 'PREMIER COMMERCIAL REAL ESTATE', bold: true, size: 28, font: 'Arial' })] })

  const logoSmall = logoData ? new Paragraph({
    children: [new ImageRun({ type: 'png', data: logoData, transformation: { width: 150, height: 37 } })],
  }) : new Paragraph({ children: [new TextRun({ text: 'PCRE', bold: true, size: 18, font: 'Arial' })] })

  const pageHeader = new Header({
    children: [
      logoSmall,
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD_BORDER, space: 2 } }, children: [] }),
    ],
  })

  const pageFooter = new Footer({
    children: [new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR, space: 2 } },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: 'Complex Issues - Simple Solutions', italic: true, size: 16, font: 'Arial', color: '666666' }),
        new TextRun({ text: '\tPage ', size: 16, font: 'Arial', color: '666666' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '666666' }),
      ],
    })],
  })

  // ── COMP DETAIL PAGES ────────────────────────────────────────────────────────
  const compPages = (comps || []).flatMap((c: Record<string, unknown>, idx: number) => {
    const photo = compPhotos[idx]
    const photoEl = photo ? new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: 'jpg', data: photo, transformation: { width: 480, height: 260 } })],
      spacing: { before: 80, after: 160 },
    }) : null
    return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      children: [new TextRun({ text: `Comparable Sale Transaction #${idx + 1}`, bold: true, size: 20, font: 'Arial', color: DARK })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD_BORDER, space: 3 } },
      spacing: { after: 160 },
    }),
    ...(photoEl ? [photoEl] : []),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [
        new TableRow({ children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: 'EBEBEB', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Building Size  ${fmt(c.building_sf as number, '', ' SF')}`, size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Lot Size  ${fmt(c.lot_size_ac as number, '', ' AC')}`, size: 18, font: 'Arial' })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: 'EBEBEB', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Ceiling Height  ${c.ceiling_height || '—'}`, size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Loading Docks  ${c.loading_docks || '—'}`, size: 18, font: 'Arial' })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: 'EBEBEB', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Sprinklers  ${c.sprinkler || '—'}`, size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Power  ${c.power || '—'}`, size: 18, font: 'Arial' })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: 'EBEBEB', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Sale Price  ${fmt(c.sale_price as number, '$')}`, size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Taxes  ${fmt(c.real_estate_taxes as number, '$', '/yr')}`, size: 18, font: 'Arial' })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: 'EBEBEB', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Sale Date  ${fmtDate(c.sale_date as string)}`, size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Buyer  ${c.buyer || '—'}`, size: 18, font: 'Arial' })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: 'EBEBEB', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Seller  ${c.seller || '—'}`, size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Price PSF  ${fmt(c.price_per_sf as number, '$')}`, size: 18, font: 'Arial' })] })] }),
        ]}),
      ],
    }),
    spacer(),
    new Paragraph({ children: [new TextRun({ text: 'Additional Comments:', bold: true, size: 18, font: 'Arial' })], spacing: { after: 40 } }),
    body('[ Enter additional comments here ]', { italic: true, color: '888888' }),
  ]})

  // ── AVAIL DETAIL PAGES ───────────────────────────────────────────────────────
  const availPages = (avails || []).flatMap((a: Record<string, unknown>, idx: number) => {
    const photo = availPhotos[idx]
    const photoEl = photo ? new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: 'jpg', data: photo, transformation: { width: 480, height: 260 } })],
      spacing: { before: 80, after: 160 },
    }) : null
    return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      children: [new TextRun({ text: `Market Sale Availability #${idx + 1}`, bold: true, size: 20, font: 'Arial', color: DARK })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD_BORDER, space: 3 } },
      spacing: { after: 160 },
    }),
    ...(photoEl ? [photoEl] : []),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [
        new TableRow({ children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: 'EBEBEB', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Building Size  ${fmt(a.building_sf as number, '', ' SF')}`, size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Lot Size  ${fmt(a.lot_size_ac as number, '', ' AC')}`, size: 18, font: 'Arial' })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: 'EBEBEB', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Ceiling Height  ${a.ceiling_height || '—'}`, size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Loading Docks  ${a.loading_docks || '—'}`, size: 18, font: 'Arial' })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: 'EBEBEB', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Asking Price  ${fmt(a.asking_price as number, '$')}`, size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Pricing Guidance  ${a.pricing_guidance || '—'}`, size: 18, font: 'Arial' })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, shading: { fill: 'EBEBEB', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Sewer  ${a.sewer || '—'}`, size: 18, font: 'Arial' })] })] }),
          new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins: { top: 80, bottom: 80, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: `Zoning  ${a.zoning || '—'}`, size: 18, font: 'Arial' })] })] }),
        ]}),
      ],
    }),
    spacer(),
    new Paragraph({ children: [new TextRun({ text: 'Additional Comments:', bold: true, size: 18, font: 'Arial' })], spacing: { after: 40 } }),
    body('[ Enter additional comments here ]', { italic: true, color: '888888' }),
  ]})

  const avgPsf = analytics?.avgPricePsf || (comps?.length ? comps.reduce((s: number, c: Record<string,unknown>) => s + (Number(c.price_per_sf) || 0), 0) / comps.length : 0)
  const now = new Date()
  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const doc = new Document({
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [
      // ── COVER PAGE ─────────────────────────────────────────────────────────────
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: [
          logoImage,
          new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD_BORDER, space: 6 } }, children: [], spacing: { after: 400 } }),
          spacer(), spacer(),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'OPINION OF VALUE', bold: true, size: 52, font: 'Arial', color: DARK })],
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Prepared For', italic: true, size: 24, font: 'Arial', color: '555555' })],
            spacing: { after: 400 },
          }),
          new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR, space: 4 } }, children: [], spacing: { after: 300 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: subject?.address || '[SUBJECT PROPERTY ADDRESS]', bold: true, size: 36, font: 'Arial', color: DARK })],
            spacing: { before: 200, after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `${subject?.county || ''} County, New York`, size: 22, font: 'Arial', color: '444444' })],
            spacing: { after: 200 },
          }),
          new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR, space: 4 } }, children: [], spacing: { after: 200 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: monthYear, italic: true, size: 22, font: 'Arial', color: '555555' })],
            spacing: { after: 600 },
          }),
          spacer(), spacer(), spacer(),
          new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR, space: 6 } }, children: [] }),
          spacer(),
          // Broker contacts
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 3120, 3120],
            rows: [
              new TableRow({ children: [
                new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders: { ...noBorders, right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR } }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Jeff Schwartzberg', bold: true, size: 20, font: 'Arial' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Managing Principal', size: 18, font: 'Arial', color: '555555' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '516-857-8013', size: 18, font: 'Arial', color: '555555' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Jbs@pcrellc.com', size: 18, font: 'Arial', color: '555555' })] }),
                ]}),
                new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders: { ...noBorders, right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR } }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Jason Miller', bold: true, size: 20, font: 'Arial' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Managing Principal', size: 18, font: 'Arial', color: '555555' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '516-413-1690', size: 18, font: 'Arial', color: '555555' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Jmiller@pcrellc.com', size: 18, font: 'Arial', color: '555555' })] }),
                ]}),
                new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders: noBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Desmond Mullins', bold: true, size: 20, font: 'Arial' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Partner, Executive Director', size: 18, font: 'Arial', color: '555555' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '631-398-5654', size: 18, font: 'Arial', color: '555555' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Dmullins@pcrellc.com', size: 18, font: 'Arial', color: '555555' })] }),
                ]}),
              ]}),
            ],
          }),
          spacer(),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Premier Commercial Real Estate, LLC', italic: true, size: 18, font: 'Arial', color: '555555' })] }),
        ],
      },

      // ── MAIN CONTENT ───────────────────────────────────────────────────────────
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers: { default: pageHeader },
        footers: { default: pageFooter },
        children: [

          // SECTION I - EXECUTIVE SUMMARY
          sectionHeading('SECTION I - EXECUTIVE SUMMARY'),
          subHeading('Purpose of Opinion'),
          body('This Opinion of Value has been prepared to:'),
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: 'Determine the fair market value of the subject property for Sale', size: 20, font: 'Arial' })], spacing: { after: 120 } }),
          spacer(),
          new Paragraph({ children: [new TextRun({ text: 'Date of Opinion:  ', bold: true, size: 20, font: 'Arial' }), new TextRun({ text: monthYear, size: 20, font: 'Arial' })], spacing: { before: 80, after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: 'Property Address:  ', bold: true, size: 20, font: 'Arial' }), new TextRun({ text: subject?.address || '—', size: 20, font: 'Arial' })], spacing: { before: 60, after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: 'County:  ', bold: true, size: 20, font: 'Arial' }), new TextRun({ text: subject?.county || '—', size: 20, font: 'Arial' })], spacing: { before: 60, after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: 'Property Type:  ', bold: true, size: 20, font: 'Arial' }), new TextRun({ text: subject?.type || '—', size: 20, font: 'Arial' })], spacing: { before: 60, after: 120 } }),
          spacer(),
          subHeading('Property Summary Highlights & Assumptions'),
          ...[
            `${fmt(subject?.size, '', ' SF')} total building size`,
            `${subject?.ceiling || '—'} ft clear ceiling height`,
            `${subject?.docks || '—'} loading dock(s) — ${subject?.driveIn || '—'} drive-in door(s)`,
            `${subject?.sprinkler || '—'} sprinkler system`,
            `${subject?.sewer || '—'} sewer connection`,
            `${subject?.power || '—'} electrical service`,
            subject?.taxes ? `Real estate taxes: ${fmt(subject.taxes, '$', '/yr')}` : 'Real estate taxes: —',
            subject?.notes || '[ Add additional highlights/assumptions ]',
          ].map(t => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: t, size: 20, font: 'Arial' })], spacing: { after: 60 } })),
          spacer(),
          subHeading('Highest and Best Use(s)'),
          body('[ Describe highest and best use(s) of the subject property ]', { italic: true, color: '888888' }),

          // PAGE BREAK — SECTION II
          new Paragraph({ children: [new PageBreak()] }),
          sectionHeading('SECTION II - BUILDING DESCRIPTION'),
          spacer(),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3240, 6120],
            rows: [
              labelValueRow('PROPERTY ADDRESS', subject?.address || '—'),
              labelValueRow('TOTAL BUILDING SF', fmt(subject?.size, '', ' SF')),
              labelValueRow('TOTAL SITE ACREAGE', subject?.lot || '—'),
              labelValueRow('CEILING HEIGHT', subject?.ceiling ? `${subject.ceiling} ft` : '—'),
              labelValueRow('DRIVE-INS', subject?.driveIn || '—'),
              labelValueRow('LOADING DOCKS', subject?.docks || '—'),
              labelValueRow('HEAT', subject?.heat || '—'),
              labelValueRow('POWER', subject?.power || '—'),
              labelValueRow('PARKING', subject?.parking || '—'),
              labelValueRow('SPRINKLER SYSTEM', subject?.sprinkler || '—'),
              labelValueRow('SEWER CONNECTION', subject?.sewer || '—'),
              labelValueRow('ZONING', subject?.zoning || '—'),
              labelValueRow('REAL ESTATE TAXES', fmt(subject?.taxes, '$', '/yr')),
              labelValueRow('YEAR BUILT', subject?.yearBuilt || '—'),
              labelValueRow('CONSTRUCTION', subject?.construction || '—'),
              labelValueRow('CONDITION', subject?.condition || '—'),
            ],
          }),

          // PAGE BREAK — SECTION III
          new Paragraph({ children: [new PageBreak()] }),
          sectionHeading('SECTION III - OPINION OF VALUE'),
          spacer(),
          body('Based upon the aforementioned assumptions, our knowledge of current market conditions, and a review of the Comparables found in Section V, it is our opinion that as of this date the Property has a fair market value of:'),
          spacer(),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3600, 5760],
            rows: [
              new TableRow({ children: [
                new TableCell({ width: { size: 3600, type: WidthType.DXA }, borders, shading: { fill: GRAY_HEADER, type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'ESTIMATED VALUE FOR SALE', bold: true, size: 20, font: 'Arial', color: WHITE })] })] }),
                new TableCell({ width: { size: 5760, type: WidthType.DXA }, borders, shading: { fill: 'FFF8E1', type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: avgPsf ? `$${Number(avgPsf).toFixed(2)} per SF  (Estimated)` : '[ $ ________________ ]', bold: true, size: 20, font: 'Arial', color: GOLD })] })] }),
              ]}),
              new TableRow({ children: [
                new TableCell({ width: { size: 3600, type: WidthType.DXA }, borders, shading: { fill: GRAY_HEADER, type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'RECOMMENDED ASKING SALE PRICE', bold: true, size: 20, font: 'Arial', color: WHITE })] })] }),
                new TableCell({ width: { size: 5760, type: WidthType.DXA }, borders, margins: { top: 120, bottom: 120, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: '[ $ ________________ ]', size: 20, font: 'Arial', color: '888888' })] })] }),
              ]}),
            ],
          }),

          // PAGE BREAK — SECTION V SALES
          new Paragraph({ children: [new PageBreak()] }),
          sectionHeading('SECTION V - RECENT SALES TRANSACTIONS & MARKET AVAILABILITIES'),
          subHeading('Recent Sale Transaction Summary'),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [2800, 1400, 1400, 1500, 1300, 960],
            rows: [
              darkHeaderRow(['Property Address', 'City / Town', 'Bldg Size (SF)', 'Sale Price', 'Sale Price PSF', 'Sale Date'], [2800, 1400, 1400, 1500, 1300, 960]),
              ...(comps || []).map((c: Record<string,unknown>, i: number) => dataRow([
                `${c.address || ''}`,
                `${c.city || ''}`,
                fmt(c.building_sf as number),
                fmt(c.sale_price as number, '$'),
                fmt(c.price_per_sf as number, '$'),
                fmtDate(c.sale_date as string),
              ], [2800, 1400, 1400, 1500, 1300, 960], i % 2 === 1)),
            ],
          }),
          spacer(),
          subHeading('Comparable Sale Transactions'),
          body('Each comparable sale transaction is detailed on the following pages.'),
          ...compPages,

          // AVAILS SUMMARY
          new Paragraph({ children: [new PageBreak()] }),
          subHeading('Market Sale Availabilities Summary'),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [2800, 1400, 1400, 1260, 1500, 1000],
            rows: [
              darkHeaderRow(['Property Address', 'City / Town', 'Bldg Size (SF)', 'Lot Size', 'Asking Sale Price', 'Price PSF'], [2800, 1400, 1400, 1260, 1500, 1000]),
              ...(avails || []).map((a: Record<string,unknown>, i: number) => dataRow([
                `${a.address || ''}`,
                `${a.city || ''}`,
                fmt(a.building_sf as number),
                fmt(a.lot_size_ac as number, '', ' AC'),
                fmt(a.asking_price as number, '$'),
                a.asking_price && a.building_sf ? `$${(Number(a.asking_price) / Number(a.building_sf)).toFixed(2)}` : '—',
              ], [2800, 1400, 1400, 1260, 1500, 1000], i % 2 === 1)),
            ],
          }),
          spacer(),
          subHeading('Market Sale Availabilities'),
          body('Each market sale availability is detailed on the following pages.'),
          ...availPages,
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = `OPV_${(subject?.address || 'Report').replace(/[^a-zA-Z0-9]/g, '_')}_${monthYear.replace(' ', '_')}.docx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
