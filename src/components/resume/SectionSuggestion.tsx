// src/components/resume/SectionSuggestion.tsx
'use client'
import { useState } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { Button } from '@/components/ui/primitives'
import { Sparkles, RefreshCw, Check, X } from 'lucide-react'
import type { SectionImproveResult, ResumeData } from '@/types/resume'

interface SectionSuggestionProps {
  resumeId: string
  section: 'skills' | 'education'
  currentAtsScore?: number | null
  onApply: (result: SectionImproveResult) => void
}

export function SectionSuggestion({ resumeId, section, currentAtsScore, onApply }: SectionSuggestionProps) {
  const { resumeData, byokCreds, jobDescription, addToast } = useResumeStore()
  const [result, setResult]   = useState<SectionImproveResult | null>(null)
  const [status, setStatus]   = useState<'idle' | 'loading' | 'ready' | 'applied' | 'denied'>('idle')

  async function fetchSuggestion() {
    if (!byokCreds.apiKey) { addToast('Add your API key first', 'error'); return }
    if (!resumeData) return
    setStatus('loading')
    setResult(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId, resumeData, jobDescription: jobDescription || undefined,
          creds: byokCreds, type: 'improve_section', section, currentAtsScore,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.result)
      setStatus('ready')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Suggestion failed', 'error')
      setStatus('idle')
    }
  }

  function apply() {
    if (!result) return
    onApply(result)
    setStatus('applied')
    addToast('Applied! Hit Re-analyze to see the real score impact.', 'success')
  }

  function deny() { setStatus('denied'); setResult(null) }
  function reset() { setStatus('idle');  setResult(null) }

  // ── Idle / denied ─────────────────────────────────────────────────────────
  if (status === 'idle' || status === 'denied') {
    return (
      <button
        onClick={fetchSuggestion}
        className="mt-2 flex items-center gap-1.5 text-xs text-violet-400/80 hover:text-violet-300 transition-colors"
      >
        <Sparkles size={11} />
        {status === 'denied' ? 'Suggest another improvement' : 'Suggest improvement'}
      </button>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <RefreshCw size={11} className="spin" />
        Generating suggestion…
      </div>
    )
  }

  // ── Applied — show confirmation + option to suggest again ────────────────
  if (status === 'applied' && result) {
    return (
      <div className="mt-2 border border-emerald-500/20 bg-emerald-500/5 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Check size={11} />Applied
          </div>
          <button
            onClick={reset}
            className="text-xs text-violet-400/70 hover:text-violet-300 transition-colors flex items-center gap-1"
          >
            <Sparkles size={10} />Suggest again
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{result.reason}</p>
      </div>
    )
  }

  // ── Ready — show before/after diff + actions ─────────────────────────────
  if (status !== 'ready' || !result) return null

  return (
    <div className="mt-2 border border-violet-500/20 rounded-lg overflow-hidden bg-[#1c1c24]">
      <div className="px-3 py-2.5 space-y-2 text-xs text-slate-300 leading-relaxed">
        <SectionPreview result={result} section={section} resumeData={resumeData} />
        <p className="text-slate-500 leading-relaxed pt-0.5">{result.reason}</p>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/7 bg-white/2">
        <Button variant="success" size="sm" onClick={apply}>
          <Check size={11} />Apply
        </Button>
        <Button size="sm" onClick={fetchSuggestion}>
          <RefreshCw size={11} />Re-suggest
        </Button>
        <Button variant="danger" size="sm" onClick={deny} className="ml-auto">
          <X size={11} />Deny
        </Button>
      </div>
    </div>
  )
}

function SectionPreview({
  result, section, resumeData,
}: {
  result: SectionImproveResult
  section: 'skills' | 'education'
  resumeData: ResumeData | null
}) {
  if (section === 'skills') {
    const current   = resumeData?.skills?.categories ?? []
    const suggested = result.skills?.categories ?? []
    return (
      <div className="space-y-1.5">
        <div className="space-y-0.5">
          {current.map((cat, i) => (
            <p key={i} className="text-red-400/80 line-through opacity-70 leading-relaxed">
              <span className="font-semibold">{cat.name}:</span> {cat.items.join(', ')}
            </p>
          ))}
        </div>
        <div className="space-y-0.5">
          {suggested.map((cat, i) => (
            <p key={i} className="text-emerald-400 leading-relaxed">
              <span className="font-semibold">{cat.name}:</span> {cat.items.join(', ')}
            </p>
          ))}
        </div>
      </div>
    )
  }

  const current   = resumeData?.education ?? []
  const suggested = result.education ?? []
  return (
    <div className="space-y-1.5">
      <div className="space-y-0.5">
        {current.map((edu, i) => (
          <p key={i} className="text-red-400/80 line-through opacity-70 leading-relaxed">
            {edu.institution}{edu.degree ? ` · ${edu.degree}` : ''}{edu.dates ? ` · ${edu.dates}` : ''}
          </p>
        ))}
      </div>
      <div className="space-y-0.5">
        {suggested.map((edu, i) => (
          <p key={i} className="text-emerald-400 leading-relaxed">
            {edu.institution}{edu.degree ? ` · ${edu.degree}` : ''}{[edu.field, edu.dates, edu.gpa && `GPA ${edu.gpa}`].filter(Boolean).join(' · ')
              ? ` · ${[edu.field, edu.dates, edu.gpa && `GPA ${edu.gpa}`].filter(Boolean).join(' · ')}` : ''}
          </p>
        ))}
      </div>
    </div>
  )
}
