// src/app/layout.tsx
import './globals.css'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { StoreHydrator } from '@/components/ui/StoreHydrator'
import type { Metadata } from 'next'

const title = 'ResumeAI — Resume Intelligence Platform'
const description = 'Upload your resume, get section-level scoring, inline editing, AI rewrites, ATS optimization, and template switching.'

export const metadata: Metadata = {
  // Required for file-convention metadata (icon.png, opengraph-image.png, etc.)
  // to resolve to real absolute URLs once deployed, instead of localhost.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title,
  description,
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0c0c0f] text-slate-100 antialiased font-sans">
        <StoreHydrator />
        {children}
        <ToastContainer />
      </body>
    </html>
  )
}