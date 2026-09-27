// src/app/s/[slug]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { renderFullHTML } from '@/lib/templates/render'
import { SharePasswordGate } from '@/components/resume/SharePasswordGate'
import type { ResumeData, TemplateId } from '@/types/resume'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

type SharedResumeResult = {
  found: boolean
  expired?: boolean
  requiresPassword?: boolean
  unlocked?: boolean
  parsedData?: ResumeData
  templateId?: TemplateId
  name?: string
}

export default async function SharePage({ params }: Props) {
  const { slug } = await params

  const supabase = await createClient()

  // The only way this (anonymous) request reads share/resume data — see
  // get_shared_resume() in supabase/migrations/002_secure_share_access.sql.
  // Called with no password first: this returns metadata (found / expired /
  // requiresPassword) but never resume content or the password hash when a
  // password is required and hasn't been supplied yet. View-count increment
  // and expiry checks happen inside the function itself.
  const { data, error } = await supabase.rpc('get_shared_resume', { p_slug: slug, p_password: null })

  if (error) {
    console.error('[SharePage]', error)
    notFound()
  }

  const result = data as SharedResumeResult | null
  if (!result?.found) notFound()

  // Check expiry
  if (result.expired) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-4xl mb-4">⏰</p>
          <h1 className="text-xl font-bold mb-2 text-slate-200">Link Expired</h1>
          <p className="text-slate-400 text-sm">This resume share link has expired.</p>
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

  const html = renderFullHTML(result.templateId ?? 'classic', result.parsedData as ResumeData)

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Minimal header bar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-black/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span className="text-sm font-semibold text-gray-700">ResumeAI</span>
          <span className="text-xs text-gray-400">· Shared Resume</span>
        </div>
        <div className="flex items-center gap-3">
          {result.name && <span className="text-sm text-gray-500">{result.name}</span>}
          <button
            onClick={() => window.print()}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Resume content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm p-10 print:shadow-none print:rounded-none print:p-0">
          <div dangerouslySetInnerHTML={{ __html: html.replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '') }} />
        </div>
      </div>

      <style>{`@media print { .sticky { display: none } .max-w-4xl { max-width: none; padding: 0 } .bg-white { box-shadow: none; border-radius: 0 } }`}</style>
    </div>
  )
}