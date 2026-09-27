// src/components/resume/ATSTab.tsx
'use client'
import { useState } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { Button, Card, CardSm, ScoreBar, Badge } from '@/components/ui/primitives'
import { Zap, ChevronDown, ChevronUp, Check, X, CheckCheck, Undo2, Redo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Suggestion } from '@/types/resume'

function asArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) return [val]
  return []
}

export function ATSTab({ resumeId }: { resumeId: string }) {
  const {
    resumeData, atsResult, jobDescription,
    setATSResult, setJobDescription, byokCreds,
    loading, setLoading, addToast, updateResumeFieldSilent,
    undo, redo, undoPast, undoFuture,
  } = useResumeStore()

  const [localJD, setLocalJD]       = useState(jobDescription)
  const [dismissed, setDismissed]   = useState<Set<string>>(new Set())
  const [accepted, setAccepted]     = useState<Set<string>>(new Set())
  const [expandedSugg, setExpanded] = useState<string | null>(null)

  async function runATS() {
    if (!resumeData || !byokCreds.apiKey) { addToast('Add API key first', 'error'); return }
    if (!localJD.trim()) { addToast('Paste a job description first', 'error'); return }
    setJobDescription(localJD)
    setLoading('ats', true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, resumeData, jobDescription: localJD, creds: byokCreds, type: 'ats' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setATSResult(data.result)
      setDismissed(new Set()); setAccepted(new Set())
      addToast('ATS analysis complete', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'ATS analysis failed', 'error')
    }
    setLoading('ats', false)
  }

  // Apply a single suggestion to resumeData without wiping the ATS results.
  // Uses updateResumeFieldSilent (same as Score tab pointer suggestions) so
  // the score cards stay visible after applying.
  function applySuggestion(s: Suggestion) {
    updateResumeFieldSilent(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      for (const exp of next.experience || []) {
        for (const bul of exp.bullets || []) {
          if (bul.id === s.targetId) { bul.text = s.suggested; return next }
        }
      }
      for (const proj of next.projects || []) {
        for (const bul of proj.bullets || []) {
          if (bul.id === s.targetId) { bul.text = s.suggested; return next }
        }
      }
      if (s.section === 'summary' || s.targetId === 'summary') {
        next.summary = s.suggested; return next
      }
      // Skills — replace skills text wholesale if targeted
      if (s.section === 'skills') {
        // skills suggestions are free-form; apply as a new flat category if we can't match
        return next
      }
      return next
    })
    setAccepted(p => new Set(p).add(s.id))
    setExpanded(null)
    addToast('Suggestion applied — undo with Ctrl+Z', 'success')
  }

  function applyAll() {
    const pending = suggestions.filter(s => !accepted.has(s.id) && !dismissed.has(s.id))
    if (!pending.length) return
    pending.forEach(s => applySuggestion(s))
    addToast(`Applied ${pending.length} suggestion${pending.length > 1 ? 's' : ''} — undo with Ctrl+Z`, 'success')
  }

  const isLoading  = loading.ats
  const suggestions = atsResult ? (asArray(atsResult.suggestions) as typeof atsResult.suggestions) : []
  const pendingCount = suggestions.filter(s => !accepted.has(s.id) && !dismissed.has(s.id)).length
  const acceptedCount = accepted.size

  return (
    <div className="mx-auto px-6 py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-violet-400" />
          <h2 className="font-bold text-lg">ATS vs Job Description</h2>
        </div>
        {/* Undo/Redo — useful after applying suggestions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { undo(); addToast('Undo', 'info', 1500) }}
            disabled={undoPast.length === 0}
            title="Undo (Ctrl+Z)"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/7 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={() => { redo(); addToast('Redo', 'info', 1500) }}
            disabled={undoFuture.length === 0}
            title="Redo (Ctrl+Shift+Z)"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/7 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 size={14} />
          </button>
        </div>
      </div>

      {/* JD Input */}
      <Card className="mb-5">
        <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2 block">Job Description</label>
        <textarea
          rows={6}
          value={localJD}
          onChange={e => setLocalJD(e.target.value)}
          placeholder="Paste the full job description here…"
          className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none mb-3"
        />
        <Button variant="primary" onClick={runATS} loading={isLoading} disabled={!localJD.trim()}>
          <Zap size={13} />
          {isLoading ? 'Analyzing…' : 'Analyze Match'}
        </Button>
      </Card>

      {/* Results */}
      {atsResult && (
        <div className="space-y-5 fade-in">
          {/* Before / After scores */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="text-center py-5">
              <p className="text-xs font-mono text-slate-500 mb-2">Current Score</p>
              <div className={cn('text-5xl font-bold font-mono mb-1',
                atsResult.atsScore.before >= 70 ? 'text-emerald-400' :
                atsResult.atsScore.before >= 45 ? 'text-amber-400' : 'text-red-400')}>
                {atsResult.atsScore.before}
              </div>
              <p className="text-xs text-slate-500">/100</p>
            </Card>
            <Card className="text-center py-5">
              <p className="text-xs font-mono text-slate-500 mb-2">
                {acceptedCount > 0 ? `After ${acceptedCount} Applied` : 'After All Suggestions'}
              </p>
              <div className="text-5xl font-bold font-mono mb-1 text-emerald-400">
                {atsResult.atsScore.after}
              </div>
              <p className="text-xs text-slate-500">+{atsResult.atsScore.after - atsResult.atsScore.before} pts</p>
            </Card>
          </div>

          {/* Breakdown */}
          {atsResult.atsScore.breakdown && (
            <Card>
              <p className="text-xs font-mono text-slate-500 mb-3">Score Breakdown</p>
              <div className="space-y-2.5">
                {Object.entries(atsResult.atsScore.breakdown).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400 capitalize">{k}</span>
                      <span className="text-xs font-mono text-slate-300">{v}</span>
                    </div>
                    <ScoreBar value={v} color="rgb(124 106 247)" />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Missing keywords */}
          {(asArray(atsResult.missingKeywords) as string[]).length > 0 && (
            <CardSm>
              <p className="text-xs font-mono text-slate-500 mb-2">Missing Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {(asArray(atsResult.missingKeywords) as string[]).map((k, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 bg-red-400/10 text-red-400 border border-red-400/20 rounded-full">{k}</span>
                ))}
              </div>
            </CardSm>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm">Suggestions</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {acceptedCount > 0
                      ? <span className="text-emerald-400">{acceptedCount} applied</span>
                      : null}
                    {acceptedCount > 0 && pendingCount > 0 && ' · '}
                    {pendingCount > 0 && `${pendingCount} pending`}
                    {dismissed.size > 0 && ` · ${dismissed.size} dismissed`}
                  </p>
                </div>
                {pendingCount > 1 && (
                  <Button size="sm" variant="success" onClick={applyAll}>
                    <CheckCheck size={12} />Apply All ({pendingCount})
                  </Button>
                )}
              </div>

              {/* Progress bar */}
              {acceptedCount > 0 && (
                <div className="h-1 w-full bg-white/5 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/60 rounded-full transition-all duration-500"
                    style={{ width: `${(acceptedCount / suggestions.length) * 100}%` }}
                  />
                </div>
              )}

              <div className="space-y-2">
                {suggestions.map(s => {
                  const isAccepted  = accepted.has(s.id)
                  const isDismissed = dismissed.has(s.id)
                  const isExpanded  = expandedSugg === s.id
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        'border rounded-xl overflow-hidden transition-all',
                        isAccepted  ? 'border-emerald-500/30 bg-emerald-500/5'  :
                        isDismissed ? 'border-white/5 opacity-40'               :
                                      'border-white/8 bg-[#16161d] hover:border-white/15'
                      )}
                    >
                      {/* Collapsed row — always shows quick Apply + Dismiss */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <PriorityDot priority={s.priority} />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => !isAccepted && !isDismissed && setExpanded(isExpanded ? null : s.id)}
                        >
                          <p className="text-xs text-slate-300 truncate">{s.reason}</p>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">
                            {s.section} · {s.category}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant={s.priority as 'high' | 'medium' | 'low'}>{s.priority}</Badge>
                          {isAccepted ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                              <Check size={12} />Applied
                            </span>
                          ) : isDismissed ? (
                            <span className="text-xs text-slate-600">Dismissed</span>
                          ) : (
                            <>
                              <button
                                onClick={() => applySuggestion(s)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                              >
                                <Check size={11} />Apply
                              </button>
                              <button
                                onClick={() => setDismissed(p => new Set(p).add(s.id))}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-white/5 text-slate-500 hover:text-red-400 transition-colors"
                              >
                                <X size={11} />
                              </button>
                              <button
                                onClick={() => setExpanded(isExpanded ? null : s.id)}
                                className="text-slate-600 hover:text-slate-400 transition-colors"
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expanded diff — original vs suggested */}
                      {isExpanded && !isAccepted && !isDismissed && (
                        <div className="px-4 pb-4 border-t border-white/7">
                          <div className="mt-3 space-y-2">
                            <div className="text-xs text-red-400/80 line-through bg-red-400/5 border border-red-400/15 rounded-lg px-3 py-2 leading-relaxed">
                              {s.original}
                            </div>
                            <div className="text-xs text-emerald-400 bg-emerald-400/5 border border-emerald-400/15 rounded-lg px-3 py-2 leading-relaxed">
                              {s.suggested}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  return (
    <div className={cn('w-2 h-2 rounded-full shrink-0',
      priority === 'high'   ? 'bg-red-400'   :
      priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'
    )} />
  )
}
