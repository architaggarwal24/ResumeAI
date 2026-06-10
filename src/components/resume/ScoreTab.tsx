'use client'
import { useResumeStore } from '@/store/resumeStore'
import { Button, Card, CardSm, StrengthBadge, ScoreBar } from '@/components/ui/primitives'
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle, User } from 'lucide-react'
import { scoreColor, scoreBg, cn } from '@/lib/utils'
import type { AnalysisResult } from '@/types/resume'

const SECTION_ORDER = ['summary', 'experience', 'skills', 'education', 'projects'] as const

// Coerce LLM response arrays — sometimes returned as string, null, or missing
function asArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) return [val]
  return []
}

function normalizeAnalysis(r: AnalysisResult): AnalysisResult {
  return {
    ...r,
    topWins:         asArray(r.topWins) as string[],
    missingKeywords: asArray(r.missingKeywords) as string[],
    recruiterVerdict: r.recruiterVerdict ? {
      ...r.recruiterVerdict,
      strengths: asArray(r.recruiterVerdict.strengths) as string[],
      gaps:      asArray(r.recruiterVerdict.gaps) as string[],
    } : r.recruiterVerdict,
    sections: r.sections ? Object.fromEntries(
      Object.entries(r.sections).map(([k, v]) => [k, v ? { ...v, reasons: asArray(v.reasons) as string[] } : v])
    ) as AnalysisResult['sections'] : r.sections,
  }
}

export function ScoreTab({ resumeId }: { resumeId: string }) {
  const {
    resumeData, analysisResult, byokCreds,
    setAnalysisResult, loading, setLoading, addToast,
  } = useResumeStore()

  async function runScoring() {
    if (!resumeData || !byokCreds.apiKey) {
      addToast('Add your API key first', 'error'); return
    }
    setLoading('analyzing', true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, resumeData, creds: byokCreds, type: 'score' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAnalysisResult(normalizeAnalysis(data.result))
      addToast('Score updated', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Scoring failed', 'error')
    }
    setLoading('analyzing', false)
  }

  const isLoading = loading.analyzing

  // Normalize on load (guards against bad DB-stored results)
  const safeResult = analysisResult ? normalizeAnalysis(analysisResult) : null

  // Auto-trigger if no result yet
  if (!safeResult && !isLoading && resumeData && byokCreds.apiKey) {
    setTimeout(runScoring, 100)
  }

  return (
    <div className="mx-auto px-6 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg">Section Analysis</h2>
          <p className="text-xs text-slate-600 mt-0.5">Scores may vary ±5 pts between runs — LLMs are non-deterministic by nature</p>
        </div>
        <Button onClick={runScoring} loading={isLoading} size="sm">
          <RefreshCw size={13} />
          {isLoading ? 'Analyzing…' : 'Re-analyze'}
        </Button>
      </div>

      {/* Loading skeleton */}
      {isLoading && !analysisResult && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      )}

      {!analysisResult && !isLoading && !byokCreds.apiKey && (
        <div className="text-center py-16 text-slate-500">
          <p className="mb-2">Add your API key to analyze this resume.</p>
          <p className="text-xs">Go to Upload → or use the BYOK panel.</p>
        </div>
      )}

      {safeResult && (
        <div className="space-y-5 fade-in">
          {/* Top row */}
          <div className="grid grid-cols-2 gap-4">
            {/* ATS Score */}
            <Card className="text-center py-6">
              <p className="text-xs font-mono text-slate-500 mb-3">Overall ATS Score</p>
              <div className={cn('text-6xl font-bold font-mono mb-1', scoreColor(safeResult!.atsScore))}>
                {safeResult!.atsScore}
              </div>
              <p className="text-xs text-slate-500 mb-3">/100</p>
              <div className="px-4">
                <ScoreBar value={safeResult!.atsScore} />
              </div>
            </Card>

            {/* Recruiter verdict */}
            {safeResult!.recruiterVerdict && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <User size={14} className="text-slate-400" />
                  <p className="text-xs font-mono text-slate-500">Recruiter Verdict</p>
                </div>
                <div className="mb-2">
                  <VerdictBadge verdict={safeResult!.recruiterVerdict.verdict} />
                </div>
                <p className="text-sm text-slate-300 mb-3">{safeResult!.recruiterVerdict.headline}</p>
                {safeResult!.recruiterVerdict.strengths?.length > 0 && (
                  <ul className="space-y-1">
                    {safeResult!.recruiterVerdict.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-400">
                        <CheckCircle size={11} className="mt-0.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>

          {/* Sections */}
          <div className="space-y-3">
            {SECTION_ORDER.map(key => {
              const s = safeResult!.sections?.[key]
              if (!s) return null
              return (
                <Card key={key}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-sm capitalize flex-1">{key}</span>
                    <StrengthBadge strength={s.strength} />
                    <span className="font-mono text-xs text-slate-400">{s.score}/100</span>
                  </div>
                  <ScoreBar value={s.score} />
                  {s.reasons?.length > 0 && (
                    <ul className="mt-2.5 space-y-1">
                      {s.reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                          <span className="mt-0.5 shrink-0">•</span>{r}
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.quickFix && (
                    <div className="mt-2.5 px-3 py-2 bg-violet-500/8 border border-violet-500/15 rounded-lg text-xs text-violet-300">
                      💡 {s.quickFix}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-2 gap-4">
            {safeResult!.topWins?.length > 0 && (
              <CardSm>
                <p className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1.5">
                  <TrendingUp size={11} />Strengths
                </p>
                {safeResult!.topWins.map((w, i) => (
                  <p key={i} className="text-xs text-emerald-400 flex items-start gap-1.5 mb-1">
                    <CheckCircle size={11} className="mt-0.5 shrink-0" />{w}
                  </p>
                ))}
              </CardSm>
            )}
            {safeResult!.missingKeywords?.length > 0 && (
              <CardSm>
                <p className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={11} />Missing Keywords
                </p>
                <div className="flex flex-wrap gap-1">
                  {safeResult!.missingKeywords.map((k, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded-full">{k}</span>
                  ))}
                </div>
              </CardSm>
            )}
          </div>

          {/* Gaps from recruiter verdict */}
          {safeResult!.recruiterVerdict?.gaps?.length > 0 && (
            <CardSm>
              <p className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={11} />Critical Gaps
              </p>
              {safeResult!.recruiterVerdict.gaps.map((g, i) => (
                <p key={i} className="text-xs text-amber-400 flex items-start gap-1.5 mb-1">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />{g}
                </p>
              ))}
            </CardSm>
          )}
        </div>
      )}
    </div>
  )
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, string> = {
    strong_yes: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
    yes:        'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    maybe:      'bg-amber-400/10 text-amber-400 border-amber-400/20',
    no:         'bg-red-400/10 text-red-400 border-red-400/20',
  }
  const labels: Record<string, string> = {
    strong_yes: '✓ Strong Yes', yes: '✓ Yes', maybe: '~ Maybe', no: '✗ No'
  }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-semibold border', styles[verdict] || styles['maybe'])}>
      {labels[verdict] || verdict}
    </span>
  )
}