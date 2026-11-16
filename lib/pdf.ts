import { sign, verify, now } from '@/lib/mcp/oauth'

// PDF export of a saved OPV. A headless Chrome opens the app's own report view
// (/?opv=<id>&view=report&pdf=1), waits until the app has built its print copy, and prints it,
// so the PDF matches what the Print button produces.

export const PDF_LINK_TTL = 60 * 60 * 24 * 7 // download links work for 7 days

export type PdfPayload = { typ: 'pdf'; id: string; exp: number }

export function pdfLink(origin: string, id: string): { url: string; expires: string } {
  const exp = now() + PDF_LINK_TTL
  const t = sign({ typ: 'pdf', id, exp })
  return { url: `${origin}/api/opv-pdf?t=${encodeURIComponent(t)}`, expires: new Date(exp * 1000).toISOString() }
}

export const verifyPdfLink = (t: unknown) => verify<PdfPayload>(t, 'pdf')

async function launch() {
  const puppeteer = (await import('puppeteer-core')).default
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true })
  }
  // Local development: use the installed Chrome (override with CHROME_PATH)
  const local = process.env.CHROME_PATH || (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome')
  return puppeteer.launch({ executablePath: local, headless: true })
}

export async function renderOpvPdf(origin: string, id: string): Promise<Uint8Array> {
  const token = process.env.AUTH_SESSION_TOKEN
  if (!token) throw new Error('AUTH_SESSION_TOKEN is not set')
  const browser = await launch()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 1000 })
    const u = new URL(origin)
    await browser.setCookie({ name: 'opv_session', value: token, domain: u.hostname, path: '/', httpOnly: true, secure: u.protocol === 'https:' })
    // Preview deployments sit behind Vercel deployment protection; Vercel's automation bypass
    // (set automatically when Protection Bypass for Automation is on) lets the browser in.
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    if (bypass) await page.goto(`${origin}/api/status?x-vercel-protection-bypass=${encodeURIComponent(bypass)}&x-vercel-set-bypass-cookie=samesitenone`, { timeout: 30000 })
    await page.goto(`${origin}/?opv=${encodeURIComponent(id)}&view=report&pdf=1`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForFunction('window.__opvPdfReady === true', { timeout: 90000 })
    return await page.pdf({ preferCSSPageSize: true, printBackground: true })
  } finally {
    await browser.close()
  }
}
