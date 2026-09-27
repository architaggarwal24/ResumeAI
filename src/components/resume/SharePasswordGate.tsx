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
    <div className="min-h-screen bg-[#0c0c0f] flex items-center justify-center p-8">
      <div className="w-full max-w-sm fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/20 flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-violet-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-1">Password Protected</h1>
          <p className="text-slate-400 text-sm">This resume requires a password to view.</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Enter password"
            onKeyDown={e => e.key === 'Enter' && verify()}
            autoFocus
            disabled={loading}
            className="w-full bg-[#16161d] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
          />
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <button
            onClick={verify}
            disabled={loading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-60"
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  )
}