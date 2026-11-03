// src/components/resume/SharePasswordGate.tsx
'use client'
import { useState } from 'react'
import { Lock } from 'lucide-react'
import { renderFullHTML } from '@/lib/templates/render'
import type { ResumeData, TemplateId } from '@/types/resume'

type UnlockedResume = { parsedData: ResumeData; templateId: TemplateId; name: string }

// Receives ONLY the slug — no resume content, no password hash. Password
// verification happens server-side via POST /api/share/unlock, which itself
// calls the get_shared_resume() Postgres function. Resume content only ever
// reaches this component in the fetch response after a correct password.
export function SharePasswordGate({ slug }: { slug: string }) {
  const [pw, setPw]         = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [resume, setResume] = useState<UnlockedResume | null>(null)

  async function verify() {
    if (!pw || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/share/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password: pw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.unlocked) {
        setError(data.error || 'Incorrect password')
        return
      }
      setResume({ parsedData: data.parsedData, templateId: data.templateId, name: data.name })
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  if (resume) {
    const html = renderFullHTML(resume.templateId ?? 'classic', resume.parsedData)
    return (
      <div className="min-h-screen bg-[#f5f5f7]">
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-black/10 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <span className="text-sm font-semibold text-gray-700">ResumeAI</span>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="bg-white rounded-2xl shadow-sm p-10">
            <div dangerouslySetInnerHTML={{ __html: html.replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '') }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink p-6">
      <div aria-hidden className="aurora-field"><i /><i /><i /></div>
      <div className="glass-strong blur-in relative w-full max-w-sm rounded-3xl p-7">
        <span aria-hidden className="edge" />
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[linear-gradient(145deg,#a78bfa,#6d28d9)] text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,.9)]">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 mb-1">Password protected</h1>
          <p className="text-slate-400 text-sm">This resume requires a password to view.</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Enter password"
            aria-label="Password"
            onKeyDown={e => e.key === 'Enter' && verify()}
            autoFocus
            disabled={loading}
            className="w-full h-12 bg-white/[0.04] border border-white/10 rounded-xl px-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-300/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,.16)]"
          />
          {error && <p role="alert" className="text-center text-sm text-rose-300">{error}</p>}
          <button
            onClick={verify}
            disabled={loading}
            type="button"
            className="btn-sheen press min-h-12 w-full rounded-xl bg-[linear-gradient(180deg,#a78bfa,#7c3aed_60%,#6d28d9)] text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(124,58,237,.9)] disabled:opacity-60"
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  )
}