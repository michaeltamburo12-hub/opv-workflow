import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['docx', 'xlsx'],
  // Headless Chrome for the PDF export (lib/pdf.ts) loads its binary from disk at runtime
  outputFileTracingIncludes: { '/api/opv-pdf': ['./node_modules/@sparticuz/chromium/bin/**'] },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.loopnet.com' },
      { protocol: 'https', hostname: 'images.loopnet.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
    ],
  },
}

export default nextConfig
