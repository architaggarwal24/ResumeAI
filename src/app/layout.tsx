// src/app/layout.tsx
import './globals.css'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { StoreHydrator } from '@/components/ui/StoreHydrator'
import { MotionProvider } from '@/components/ui/glass/MotionTier'
import { fontSans, fontMono } from './fonts'
import type { Metadata, Viewport } from 'next'
import { connection } from 'next/server'

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

export const viewport: Viewport = {
  themeColor: '#07080a',
  colorScheme: 'dark',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render per request so every page gets the CSP nonce from src/proxy.ts.
  // Prerendered HTML would carry no nonce and its scripts would be blocked.
  await connection()
  return (
    <html lang="en" className={`dark ${fontSans.variable} ${fontMono.variable}`} data-motion="lite">
      <body className="bg-ink font-sans text-slate-100 antialiased">
        <MotionProvider>
          <StoreHydrator />
          {children}
          <ToastContainer />
        </MotionProvider>
        <div aria-hidden className="grain" />
      </body>
    </html>
  )
}
