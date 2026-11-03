// src/app/s/[slug]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { renderFullHTML } from '@/lib/templates/render'
import { SharePasswordGate } from '@/components/resume/SharePasswordGate'
import { Clock } from 'lucide-react'
import { PrintButton } from '@/components/resume/PrintButton'
import { sanitizeResumeData, isTemplateId } from '@/lib/security/resume-schema'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

type SharedResumeResult = {
  found: boolean
  expired?: boolean
  requiresPassword?: boolean
  unlocked?: boolean
  parsedData?: unknown
  templateId?: string
  name?: string
}

export default async function SharePage({ params }: Props) {
  const { slug } = await params
  // Slugs are generated server-side as base64url; anything else can't exist.
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(slug)) notFound()

  const supabase = await createClient()

  // The only way this (anonymous) request reads share/resume data — see
  // get_shared_resume() in supabase/migrations/002_secure_share_access.sql.
  // Called with no password first: this returns metadata (found / expired /
  // requiresPassword) but never resume content or the password hash when a
  // password is required and hasn't been supplied yet. View-count increment
  // and expiry checks happen inside the function itself.
  const { data, error } = await supabase.rpc('get_shared_resume', { p_slug: slug, p_password: null })

  if (error) {
    console.error('[SharePage]', error.code)
    return notFound()
  }

  const result = data as SharedResumeResult | null
  if (!result?.found) return notFound()

  // Check expiry
  if (result.expired) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink p-6">
        <div aria-hidden className="aurora-field"><i /><i /><i /></div>
        <div className="glass-strong relative w-full max-w-sm rounded-3xl p-8 text-center">
          <span aria-hidden className="edge" />
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-white/[0.06] text-slate-300"><Clock size={24} /></div>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white">Link expired</h1>
          <p className="text-sm text-slate-400">This resume share link has expired. Ask the owner for a new one.</p>
        </div>
      </div>
    )
  }

  // Password protected and not yet unlocked — render ONLY the password
  // form. No resume data and no password hash reach the client at this
  // point (compare to the old implementation, which sent both as props to
  // a 'use client' component before the password was ever checked).
  if (result.requiresPassword && !result.unlocked) {
    return <SharePasswordGate slug={slug} />
  }

  // Stored data is untrusted: normalise before rendering server-side.
  const resume = sanitizeResumeData(result.parsedData)
  if (!resume) return notFound()
  const html = renderFullHTML(isTemplateId(result.templateId) ? result.templateId : 'classic', resume)

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink print:bg-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-70 print:hidden"><div className="aurora-field"><i /><i /><i /></div></div>
      {/* Minimal header bar */}
      <div className="sticky top-0 z-10 px-3 pt-3 sm:px-6">
        <div className="glass-strong mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,.9)]" />
            <span className="text-sm font-semibold text-white">Resume<span className="text-violet-300">AI</span></span>
            <span className="hidden text-xs text-slate-400 sm:inline">· Shared resume</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {result.name && <span className="truncate text-sm text-slate-300">{String(result.name).slice(0, 200)}</span>}
            <PrintButton />
          </div>
        </div>
      </div>

      {/* Resume content */}
      <div className="relative max-w-4xl mx-auto px-3 py-8 sm:px-6 sm:py-10">
        <div className="bg-white rounded-2xl p-6 shadow-[0_40px_120px_-40px_rgba(139,92,246,.55),0_20px_50px_-30px_rgba(0,0,0,.9)] ring-1 ring-white/10 sm:p-10 print:shadow-none print:ring-0 print:rounded-none print:p-0">
          <div dangerouslySetInnerHTML={{ __html: html.replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '') }} />
        </div>
      </div>

      <style>{`@media print { .sticky { display: none } .max-w-4xl { max-width: none; padding: 0 } .bg-white { box-shadow: none; border-radius: 0 } }`}</style>
    </div>
  )
}