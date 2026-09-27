// src/app/layout.tsx
import './globals.css'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { StoreHydrator } from '@/components/ui/StoreHydrator'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ResumeAI — Resume Intelligence Platform',
  description: 'Upload your resume, get section-level scoring, inline editing, AI rewrites, ATS optimization, and template switching.',
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