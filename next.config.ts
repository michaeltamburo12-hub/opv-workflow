import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['docx', 'xlsx'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.loopnet.com' },
      { protocol: 'https', hostname: 'images.loopnet.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
    ],
  },
}

export default nextConfig
