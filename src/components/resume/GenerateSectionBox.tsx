// src/components/resume/GenerateSectionBox.tsx
'use client'
import { useState } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { Button } from '@/components/ui/primitives'
import { Sparkles, RefreshCw, Check, X, AlertTriangle } from 'lucide-react'
import type { GenerateSectionResult, GeneratableSection } from '@/types/resume'

interface GenerateSectionBoxProps {
  resumeId: string
  section: GeneratableSection
  label: string
  onApply: (result: GenerateSectionResult) => void
}

// Shown inside a section row when that section is empty/near-empty — lets the
// user generate a draft for it from the rest of the resume, preview it, and
// apply or discard.
export function GenerateSectionBox({ resumeId, section, label, onApply }: GenerateSectionBoxProps) {
  const { resumeData, byokCreds, jobDescription, addToast } = useResumeStore()
  const [result, setResult]   = useState<GenerateSectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState<'pending' | 'applied' | 'denied'>('pending')

  async function generate() {
    if (!byokCreds.apiKey) { addToast('Add your API key first', 'error'); return }
    if (!resumeData) return
    setLoading(true)
    setStatus('pending')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId, resumeData, jobDescription: jobDescription || undefined,
          creds: byokCreds, type: 'generate_section', section,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.result)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Generation failed', 'error')
    }
    setLoading(false)
  }

  function apply() {
    if (!result) return
    onApply(result)
    setStatus('applied')
    addToast(`${label} generated — review and edit in the Edit tab, then Re-analyze`, 'success')
  }

  function deny() {
    setStatus('denied')
    setResult(null)
  }

  if (!result && !loading && status !== 'applied') {
    return (
      <button
        onClick={generate}
        className="mt-2 flex items-center gap-1.5 text-xs text-violet-400/80 hover:text-violet-300 transition-colors"
      >
        <Sparkles size={11} />
        {status === 'denied' ? `Try generating ${label} again` : `Generate ${label} with AI`}
      </button>
    )
  }

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <RefreshCw size={11} className="spin" />
        Drafting {label.toLowerCase()}…
      </div>
    )
  }

  if (status === 'applied') {
    return (
      <div className="mt-2 border border-emerald-500/20 bg-emerald-500/5 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <Check size={11} />Added — head to the Edit tab to review and fine-tune
        </div>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="mt-2 border border-violet-500/20 rounded-lg overflow-hidden bg-[#1c1c24]">
      <div className="px-3 py-2.5 space-y-2 text-xs text-slate-300 leading-relaxed">
        <GeneratedPreview result={result} section={section} />
        {result.note && (
          <div className="flex items-start gap-1.5 px-2.5 py-1.5 bg-amber-500/8 border border-amber-500/15 rounded-lg text-amber-300">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            <span>{result.note}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/7 bg-white/2">
        <Button variant="success" size="sm" onClick={apply}>
          <Check size={11} />Add to resume
        </Button>
        <Button size="sm" onClick={generate}>
          <RefreshCw size={11} />Re-suggest
        </Button>
        <Button variant="danger" size="sm" onClick={deny} className="ml-auto">
          <X size={11} />Deny
        </Button>
      </div>
    </div>
  )
}

function GeneratedPreview({ result, section }: { result: GenerateSectionResult; section: GeneratableSection }) {
  switch (section) {
    case 'summary':
      return <p>{result.summary}</p>

    case 'experience':
      return (
        <div className="space-y-3">
          {(result.experience ?? []).map((exp, i) => (
            <div key={i}>
              <p className="font-semibold text-slate-200">{exp.title}{exp.company ? ` · ${exp.company}` : ''}</p>
              {exp.dates && <p className="text-slate-500">{exp.dates}{exp.location ? ` · ${exp.location}` : ''}</p>}
              <ul className="mt-1 space-y-0.5">
                {exp.bullets.map((b, bi) => (
                  <li key={bi} className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">•</span>{b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {(result.experience ?? []).length === 0 && <p className="text-slate-500">No new entries — see note below.</p>}
        </div>
      )

    case 'education':
      return (
        <div className="space-y-2">
          {(result.education ?? []).map((edu, i) => (
            <div key={i}>
              <p className="font-semibold text-slate-200">{edu.institution}{edu.degree ? ` · ${edu.degree}` : ''}</p>
              <p className="text-slate-500">{[edu.field, edu.dates, edu.gpa && `GPA ${edu.gpa}`].filter(Boolean).join(' · ')}</p>
            </div>
          ))}
        </div>
      )

    case 'projects':
      return (
        <div className="space-y-3">
          {(result.projects ?? []).map((proj, i) => (
            <div key={i}>
              <p className="font-semibold text-slate-200">{proj.name}{proj.tech ? ` · ${proj.tech}` : ''}</p>
              <p className="text-slate-400">{proj.description}</p>
              <ul className="mt-1 space-y-0.5">
                {proj.bullets.map((b, bi) => (
                  <li key={bi} className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">•</span>{b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )

    case 'skills':
      return (
        <div className="space-y-1">
          {(result.skills?.categories ?? []).map((cat, i) => (
            <p key={i}><span className="font-semibold text-slate-200">{cat.name}:</span> {cat.items.join(', ')}</p>
          ))}
        </div>
      )

    default:
      return null
  }
}
