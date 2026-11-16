export const runtime = 'nodejs'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hasSession } from '@/lib/session'
import { renderOpvPdf, verifyPdfLink } from '@/lib/pdf'

// GET /api/opv-pdf?t=<signed link from the Claude connector>   (no login needed, expires)
// GET /api/opv-pdf?id=<opv id>                                   (signed-in app users)
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t')
  let id: string | null = null
  if (t) {
    const p = verifyPdfLink(t)
    if (!p) return new NextResponse('This download link has expired. Ask Claude for a new one.', { status: 403 })
    id = p.id
  } else if (hasSession(req)) {
    id = req.nextUrl.searchParams.get('id')
  } else {
    return new NextResponse('Sign in required', { status: 401 })
  }
  if (!id) return new NextResponse('id required', { status: 400 })

  const { data, error } = await supabaseAdmin.from('opv_reports').select('id,address,assignment_json').eq('id', id).maybeSingle()
  if (error) return new NextResponse(error.message, { status: 500 })
  if (!data) return new NextResponse('This OPV no longer exists.', { status: 404 })

  try {
    const pdf = await renderOpvPdf(req.nextUrl.origin, id)
    const name = `OPV - ${String(data.address || 'Report').replace(/[^\w ,.#-]+/g, '').trim()}.pdf`
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('opv-pdf failed', id, e)
    return new NextResponse('Could not build the PDF: ' + (e as Error).message, { status: 500 })
  }
}
