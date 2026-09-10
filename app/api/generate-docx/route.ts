export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const _htmlDocxMod = require('html-to-docx')
const HTMLtoDOCX: (...args: unknown[]) => Promise<Buffer> =
  typeof _htmlDocxMod === 'function' ? _htmlDocxMod
  : typeof _htmlDocxMod?.default === 'function' ? _htmlDocxMod.default
  : _htmlDocxMod?.HTMLtoDOCX ?? _htmlDocxMod

// Resolve every img src in the HTML to a data URI so Word can embed them.
async function resolveImages(html: string): Promise<string> {
  const srcPattern = /src="([^"]+)"/g
  const srcs = new Set<string>()
  for (const m of html.matchAll(srcPattern)) {
    const s = m[1]
    if (s && !s.startsWith('data:') && !s.startsWith('blob:')) srcs.add(s)
  }
  if (!srcs.size) return html

  const resolved = await Promise.all(
    [...srcs].map(async (src) => {
      let fetchUrl = src
      if (src.includes('/api/proxy-image?url=')) {
        fetchUrl = decodeURIComponent(src.split('?url=')[1] || '')
      } else if (src.startsWith('/')) {
        // Relative URL — skip (can't fetch without a host in serverless)
        return { src, data: src }
      }
      try {
        const res = await fetch(fetchUrl, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        })
        if (!res.ok) return { src, data: src }
        const ct = res.headers.get('content-type') || 'image/jpeg'
        const b64 = Buffer.from(await res.arrayBuffer()).toString('base64')
        return { src, data: `data:${ct};base64,${b64}` }
      } catch {
        return { src, data: src }
      }
    })
  )

  let out = html
  for (const { src, data } of resolved) {
    if (data !== src) out = out.split(src).join(data)
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const { html, subject } = await req.json()

    if (!html) return NextResponse.json({ error: 'No HTML content' }, { status: 400 })
    if (typeof HTMLtoDOCX !== 'function') {
      return NextResponse.json({ error: `html-to-docx did not export a function (got ${typeof HTMLtoDOCX}). Module keys: ${Object.keys(_htmlDocxMod||{}).join(',')}` }, { status: 500 })
    }

    // Resolve all external images to data URIs server-side
    const processedHTML = await resolveImages(html)

    // Wrap in a full HTML document. html-to-docx reads inline styles
    // and basic CSS — keep base styles tight so they don't fight the
    // inline styles already baked into the Generate Package HTML.
    const fullHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; margin: 0; padding: 0; background: #fff; color: #1a1a1a; }
  * { box-sizing: border-box; }
  table { border-collapse: collapse; width: 100%; }
  td, th { vertical-align: middle; }
  img { max-width: 100%; height: auto; display: block; }
  p { margin: 0 0 6pt 0; }
  button, input, select, textarea, [data-no-print] { display: none !important; }
</style>
</head>
<body>${processedHTML}</body>
</html>`

    const result = await HTMLtoDOCX(fullHTML, null, {
      table: { row: { cantSplit: true } },
      margins: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
      title: subject?.address ? `OPV — ${subject.address}` : 'OPV Report',
      orientation: 'portrait',
      font: 'Arial',
      fontSize: 22,
    })

    if (!result) {
      return NextResponse.json({ error: 'Document generation returned empty — HTML may be too complex' }, { status: 500 })
    }

    const filename = subject?.address
      ? `OPV_${subject.address.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}.docx`
      : 'OPV_Report.docx'

    return new NextResponse(result as Buffer, {
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
