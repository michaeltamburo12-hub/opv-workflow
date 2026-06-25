import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OPV Workflow | Premier Commercial Real Estate',
  description: 'Opinion of Value workflow for Long Island industrial properties',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
