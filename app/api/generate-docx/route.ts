export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore
import HTMLtoDOCX from 'html-to-docx'

// Resolve a src attribute to a data URI the DOCX renderer can embed.
// Handles:
//   - data: URIs  → pass through
//   - /api/proxy-image?url=...  → extract real URL and fetch
//   - https://...  → fetch directly
//   - anything else → return as-is (will likely be skipped by renderer)
async function srcToDataURI(src: string): Promise<string> {
  if (!src) return src
  if (src.startsWith('data:')) return src

  let fetchUrl = src
  if (src.includes('/api/proxy-image?url=')) {
    const qs = src.split('?url=')[1]
    if (qs) fetchUrl = decodeURIComponent(qs)
  } else if (src.startsWith('/')) {
    return src // relative path — can't resolve server-side without a host
  }

  try {
    const res = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OPV-DocGen/1.0)' },
    })
    if (!res.ok) return src
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${contentType};base64,${buf.toString('base64')}`
  } catch {
    return src
  }
}

// Find every unique img src in the HTML, resolve them all in parallel,
// then do a single-pass string replace.
async function resolveImages(html: string): Promise<string> {
  const srcPattern = /src="([^"]+)"/g
  const srcs = new Set<string>()
  for (const m of html.matchAll(srcPattern)) {
    const s = m[1]
    if (s && !s.startsWith('data:')) srcs.add(s)
  }
  if (!srcs.size) return html

  const resolved = await Promise.all(
    [...srcs].map(async s => ({ s, d: await srcToDataURI(s) }))
  )

  let out = html
  for (const { s, d } of resolved) {
    if (d !== s) {
      // Replace all occurrences (split-join is safe for URL strings)
      out = out.split(s).join(d)
    }
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const { html, subject } = await req.json()

    if (!html) return NextResponse.json({ error: 'No HTML content provided' }, { status: 400 })

    // Pre-process: fetch all external images and embed as data URIs
    const processedHTML = await resolveImages(html)

    // Wrap in a complete HTML document.
    // html-to-docx reads inline styles and basic CSS — keep it close to
    // what the Generate Package renders so the structure is preserved.
    const fullHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    font-family: Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 10pt;
  }
  td, th {
    padding: 5pt 8pt;
    border: 1px solid #cccccc;
    font-size: 10pt;
    vertical-align: middle;
  }
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin-bottom: 8pt;
  }
  h1, h2, h3, h4 {
    font-family: Arial, sans-serif;
  }
  p {
    margin: 0 0 6pt 0;
  }
</style>
</head>
<body>
${processedHTML}
</body>
</html>`

    const docxBuffer = await HTMLtoDOCX(fullHTML, null, {
      table: { row: { cantSplit: true } },
      margins: { top: 1080, bottom: 1080, left: 1440, right: 1440 },
      title: subject?.address ? `OPV — ${subject.address}` : 'OPV Report',
      orientation: 'portrait',
      font: 'Arial',
    })

    const filename = subject?.address
      ? `OPV_${subject.address.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}.docx`
      : 'OPV_Report.docx'

    return new NextResponse(docxBuffer, {
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
