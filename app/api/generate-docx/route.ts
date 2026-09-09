export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore
import HTMLtoDOCX from 'html-to-docx'

export async function POST(req: NextRequest) {
  try {
    const { html, address } = await req.json()
    if (!html) return NextResponse.json({ error: 'No HTML provided' }, { status: 400 })

    // Wrap with minimal styling so the conversion looks clean
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #ccc; padding: 6px 10px; font-size: 10pt; }
          h1 { font-size: 18pt; font-weight: bold; }
          h2 { font-size: 14pt; font-weight: bold; margin-top: 18pt; }
          h3 { font-size: 12pt; font-weight: bold; }
          img { max-width: 100%; }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `

    const docx = await HTMLtoDOCX(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
    })

    const filename = address
      ? `OPV_${address.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}.docx`
      : 'OPV_Report.docx'

    return new NextResponse(docx, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
