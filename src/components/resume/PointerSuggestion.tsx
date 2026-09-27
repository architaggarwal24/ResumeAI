// src/components/resume/PointerSuggestion.tsx
'use client'
import { useState } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { Button } from '@/components/ui/primitives'
import { Sparkles, RefreshCw, Check, X } from 'lucide-react'
import type { PointerSuggestionResult } from '@/types/resume'

interface PointerSuggestionProps {
  resumeId: string
  targetId: string
  sectionContext: string
  currentText: string
  currentAtsScore?: number | null
  onApply: (newText: string) => void
}

export function PointerSuggestion({
  resumeId, targetId, sectionContext, currentText, currentAtsScore, onApply,
}: PointerSuggestionProps) {
  const { resumeData, byokCreds, jobDescription, addToast } = useResumeStore()
  const [result, setResult]   = useState<PointerSuggestionResult | null>(null)
  const [status, setStatus]   = useState<'idle' | 'loading' | 'ready' | 'applied' | 'denied'>('idle')

  async function fetchSuggestion() {
    if (!byokCreds.apiKey) { addToast('Add your API key first', 'error'); return }
    if (!resumeData || !currentText.trim()) return
    setStatus('loading')
    setResult(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId, resumeData, jobDescription: jobDescription || undefined,
          creds: byokCreds, type: 'pointer',
          pointer: { targetId, currentText, sectionContext, currentAtsScore },
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
    onApply(result.suggested)
    setStatus('applied')
    addToast('Applied! Hit Re-analyze to see the real score impact.', 'success')
  }

  function deny() {
    setStatus('denied')
    setResult(null)
  }

  function reset() {
    setStatus('idle')
    setResult(null)
  }

  // ── Idle / denied — just the trigger link ────────────────────────────────
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

  // ── Applied — show what was applied + option to suggest again ────────────
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

  // ── Ready — show diff + action buttons ───────────────────────────────────
  if (status !== 'ready' || !result) return null

  return (
    <div className="mt-2 border border-violet-500/20 rounded-lg overflow-hidden bg-[#1c1c24]">
      <div className="px-3 py-2.5 space-y-1.5">
        <p className="text-xs text-red-400/70 line-through leading-relaxed">{currentText}</p>
        <p className="text-xs text-emerald-400 leading-relaxed">{result.suggested}</p>
        <p className="text-xs text-slate-500 leading-relaxed pt-0.5">{result.reason}</p>
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
