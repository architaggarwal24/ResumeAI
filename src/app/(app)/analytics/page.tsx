// src/app/(app)/analytics/page.tsx
'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn, scoreColor } from '@/lib/utils'
import { BarChart2, TrendingUp, TrendingDown, Minus, FileText, Award, RefreshCw, ChevronRight } from 'lucide-react'
import { Card, CardSm, ScoreBar } from '@/components/ui/primitives'
import type { AnalyticsDashboard, ResumeAnalyticsSummary, ScoreDataPoint } from '@/types/resume'

export default function AnalyticsPage() {
  const [data, setData]     = useState<AnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); if (d.resumes?.[0]) setSelected(d.resumes[0].resumeId) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <AnalyticsSkeleton />
  if (!data || data.totalResumes === 0) return <AnalyticsEmpty />

  const selectedResume = data.resumes.find(r => r.resumeId === selected)

  return (
    <div className="mx-auto px-8 py-8 max-w-6xl fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mb-1">
          <BarChart2 size={20} className="text-violet-400" />Analytics
        </h1>
        <p className="text-slate-400 text-sm">Score history, improvement trends, and cross-resume comparison.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Analyses',   value: data.totalAnalyses,                         icon: <RefreshCw size={14}/> },
          { label: 'Resumes Tracked',  value: data.totalResumes,                          icon: <FileText size={14}/> },
          { label: 'Average Score',    value: data.avgScore != null ? data.avgScore : '—', icon: <BarChart2 size={14}/> },
          { label: 'Best Score',       value: data.bestScore != null ? data.bestScore : '—', icon: <Award size={14}/> },
        ].map(stat => (
          <Card key={stat.label} className="text-center py-5">
            <div className="flex justify-center text-violet-400 mb-2">{stat.icon}</div>
            <p className="text-3xl font-bold font-mono mb-1">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
          </Card>
        ))}
      </div>

      {data.mostImproved && (
        <div className="mb-8 px-5 py-4 bg-emerald-400/8 border border-emerald-400/20 rounded-xl flex items-center gap-3">
          <TrendingUp size={18} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">Most Improved</p>
            <p className="text-xs text-slate-400">
              <span className="text-slate-200">{data.mostImproved.resumeName}</span>
              {' '}improved by{' '}
              <span className="text-emerald-400 font-mono font-bold">+{data.mostImproved.improvement} pts</span>
            </p>
          </div>
          <Link href={`/resume/${data.mostImproved.resumeId}`}
            className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            Open <ChevronRight size={12}/>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Resume list */}
        <div className="col-span-1">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Resumes</p>
          <div className="space-y-2">
            {data.resumes.map(r => (
              <div key={r.resumeId}
                onClick={() => setSelected(r.resumeId)}
                className={cn(
                  'px-4 py-3 rounded-xl border cursor-pointer transition-all',
                  selected === r.resumeId
                    ? 'border-violet-500/40 bg-violet-500/8'
                    : 'border-white/7 bg-[#16161d] hover:border-white/15'
                )}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium truncate flex-1 mr-2">{r.resumeName}</p>
                  {r.currentScore != null && (
                    <span className={cn('text-xs font-mono font-bold shrink-0', scoreColor(r.currentScore))}>
                      {r.currentScore}
                    </span>
                  )}
                </div>
                {r.currentScore != null && <ScoreBar value={r.currentScore} />}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-slate-600">{r.totalAnalyses} analyse{r.totalAnalyses !== 1 ? 's' : ''}</span>
                  {r.improvement != null && (
                    <ImprovementChip improvement={r.improvement} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="col-span-2">
          {selectedResume ? (
            <ResumeDetail resume={selectedResume} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600">
              Select a resume to see its score history
            </div>
          )}
        </div>
      </div>

      {/* Cross-resume comparison */}
      {data.resumes.length > 1 && (
        <div className="mt-8">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-4">Cross-Resume Comparison</p>
          <Card>
            <div className="space-y-4">
              {[...data.resumes]
                .filter(r => r.currentScore != null)
                .sort((a, b) => (b.currentScore ?? 0) - (a.currentScore ?? 0))
                .map((r, i) => (
                  <div key={r.resumeId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-600 w-4">{i + 1}</span>
                        <Link href={`/resume/${r.resumeId}`}
                          className="text-sm text-slate-200 hover:text-violet-300 transition-colors truncate max-w-xs">
                          {r.resumeName}
                        </Link>
                        {r.improvement != null && r.improvement > 0 && (
                          <span className="text-xs text-emerald-400 font-mono">+{r.improvement}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {r.peakScore != null && r.peakScore !== r.currentScore && (
                          <span className="text-xs text-slate-600 font-mono">peak {r.peakScore}</span>
                        )}
                        <span className={cn('text-sm font-mono font-bold w-8 text-right', scoreColor(r.currentScore ?? 0))}>
                          {r.currentScore}
                        </span>
                      </div>
                    </div>
                    <ScoreBar value={r.currentScore ?? 0} />
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function ResumeDetail({ resume }: { resume: ResumeAnalyticsSummary }) {
  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-bold text-lg truncate">{resume.resumeName}</h2>
          <p className="text-xs text-slate-500">{resume.totalAnalyses} analyses recorded</p>
        </div>
        <Link href={`/resume/${resume.resumeId}`}
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
          Open resume <ChevronRight size={12}/>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Current', value: resume.currentScore, color: resume.currentScore != null ? scoreColor(resume.currentScore) : '' },
          { label: 'Peak',    value: resume.peakScore,    color: resume.peakScore    != null ? scoreColor(resume.peakScore)    : '' },
          { label: 'Change',  value: resume.improvement != null ? (resume.improvement >= 0 ? `+${resume.improvement}` : String(resume.improvement)) : '—',
            color: resume.improvement == null ? '' : resume.improvement > 0 ? 'text-emerald-400' : resume.improvement < 0 ? 'text-red-400' : 'text-slate-400' },
        ].map(stat => (
          <CardSm key={stat.label} className="text-center">
            <p className="text-xs font-mono text-slate-500 mb-1">{stat.label}</p>
            <p className={cn('text-2xl font-bold font-mono', stat.color)}>{stat.value ?? '—'}</p>
          </CardSm>
        ))}
      </div>

      {/* Score history chart */}
      {resume.scoreHistory.length > 0 ? (
        <Card>
          <p className="text-xs font-mono text-slate-500 mb-4">Score History</p>
          <ScoreHistoryChart history={resume.scoreHistory} />
        </Card>
      ) : (
        <Card className="text-center py-8 text-slate-600">
          <p className="text-sm">No score history yet.</p>
          <p className="text-xs mt-1">Run an analysis from the Score tab to start tracking.</p>
        </Card>
      )}

      {/* History table */}
      {resume.scoreHistory.length > 1 && (
        <Card>
          <p className="text-xs font-mono text-slate-500 mb-3">Analysis Log</p>
          <div className="space-y-1">
            {[...resume.scoreHistory].reverse().map((pt, i) => (
              <div key={pt.analysisId} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-none">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 font-mono w-6">{resume.scoreHistory.length - i}</span>
                  <span className="text-xs text-slate-400">{new Date(pt.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center gap-3">
                  {i < resume.scoreHistory.length - 1 && (() => {
                    const prev = [...resume.scoreHistory].reverse()[i + 1]?.score ?? pt.score
                    const delta = pt.score - prev
                    if (delta === 0) return null
                    return <span className={cn('text-xs font-mono', delta > 0 ? 'text-emerald-400' : 'text-red-400')}>{delta > 0 ? '+' : ''}{delta}</span>
                  })()}
                  <span className={cn('text-sm font-mono font-bold', scoreColor(pt.score))}>{pt.score}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function ScoreHistoryChart({ history }: { history: ScoreDataPoint[] }) {
  if (history.length === 0) return null

  const min = Math.max(0, Math.min(...history.map(h => h.score)) - 10)
  const max = Math.min(100, Math.max(...history.map(h => h.score)) + 10)
  const range = max - min || 10
  const W = 600
  const H = 140
  const PAD = { t: 16, r: 16, b: 32, l: 32 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  const points = history.map((pt, i) => ({
    x: PAD.l + (i / Math.max(history.length - 1, 1)) * chartW,
    y: PAD.t + chartH - ((pt.score - min) / range) * chartH,
    ...pt,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const fillD = `${pathD} L ${points[points.length - 1].x} ${PAD.t + chartH} L ${points[0].x} ${PAD.t + chartH} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
      <defs>
        <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c6af7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#7c6af7" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 25, 50, 75, 100].filter(v => v >= min && v <= max + 5).map(v => {
        const y = PAD.t + chartH - ((v - min) / range) * chartH
        return (
          <g key={v}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={PAD.l - 4} y={y + 4} fontSize="9" fill="rgba(255,255,255,0.2)" textAnchor="end">{v}</text>
          </g>
        )
      })}

      {/* Fill */}
      <path d={fillD} fill="url(#scoreGrad)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="#7c6af7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#7c6af7" />
          <circle cx={p.x} cy={p.y} r="2" fill="white" />
          {/* Label below */}
          <text x={p.x} y={H - 4} fontSize="9" fill="rgba(255,255,255,0.3)" textAnchor="middle">{p.label}</text>
        </g>
      ))}

      {/* Score labels on points */}
      {points.map((p, i) => (
        <text key={`lbl-${i}`} x={p.x} y={p.y - 8} fontSize="10"
          fill={p.score >= 70 ? '#34d399' : p.score >= 45 ? '#fbbf24' : '#f87171'}
          textAnchor="middle" fontWeight="600">
          {p.score}
        </text>
      ))}
    </svg>
  )
}

function ImprovementChip({ improvement }: { improvement: number }) {
  if (improvement === 0) return <span className="text-xs text-slate-600 flex items-center gap-0.5"><Minus size={10} />0</span>
  if (improvement > 0)   return <span className="text-xs text-emerald-400 flex items-center gap-0.5"><TrendingUp size={10} />+{improvement}</span>
  return                        <span className="text-xs text-red-400 flex items-center gap-0.5"><TrendingDown size={10} />{improvement}</span>
}

function AnalyticsSkeleton() {
  return (
    <div className="mx-auto px-8 py-8 max-w-6xl">
      <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse mb-8" />
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white/5 rounded-xl animate-pulse" />)}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
        <div className="col-span-2 h-80 bg-white/5 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}

function AnalyticsEmpty() {
  return (
    <div className="mx-auto px-8 py-8 max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mb-8">
        <BarChart2 size={20} className="text-violet-400" />Analytics
      </h1>
      <div className="border-2 border-dashed border-white/8 rounded-2xl p-16 text-center">
        <BarChart2 size={48} className="text-slate-600 mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">No data yet</h3>
        <p className="text-slate-400 text-sm mb-6">Upload a resume and run a score analysis to start tracking your progress.</p>
        <Link href="/upload"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all">
          Upload Resume
        </Link>
      </div>
    </div>
  )
}
