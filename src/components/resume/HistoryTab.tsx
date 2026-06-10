'use client'
import { useState, useEffect, useCallback } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { Button, Card, CardSm } from '@/components/ui/primitives'
import { callLLM } from '@/lib/llm/client'
import { VERSION_DIFF_PROMPT } from '@/lib/llm/prompts'
import { formatDate, scoreColor, cn } from '@/lib/utils'
import { History, Plus, RotateCcw, Trash2, ChevronRight, TrendingUp, TrendingDown, Minus, Loader2, GitBranch } from 'lucide-react'
import type { ResumeData } from '@/types/resume'

interface VersionMeta { id: string; label: string; ats_score: number | null; created_at: string }
interface VersionFull extends VersionMeta { parsed_data: ResumeData }
interface DiffChange { section: string; type: 'added'|'removed'|'modified'; description: string }
interface DiffResult { summary: string; changes: DiffChange[]; impact: 'positive'|'neutral'|'negative'; impactReason: string }

export function HistoryTab({ resumeId }: { resumeId: string }) {
  const { resumeData, analysisResult, byokCreds, addToast, setResumeData, setAnalysisResult } = useResumeStore()
  const [versions, setVersions]        = useState<VersionMeta[]>([])
  const [loadingV, setLoadingV]        = useState(true)
  const [savingSnap, setSaving]        = useState(false)
  const [label, setLabel]              = useState('')
  const [showLabel, setShowLabel]      = useState(false)
  const [selectedId, setSelectedId]    = useState<string|null>(null)
  const [selected, setSelected]        = useState<VersionFull|null>(null)
  const [loadingD, setLoadingD]        = useState(false)
  const [diff, setDiff]                = useState<DiffResult|null>(null)
  const [loadingDiff, setLoadingDiff]  = useState(false)
  const [restoring, setRestoring]      = useState(false)
  const [deletingId, setDeletingId]    = useState<string|null>(null)

  const fetchVersions = useCallback(async () => {
    setLoadingV(true)
    try {
      const res = await fetch(`/api/resume/${resumeId}/versions`)
      const data = await res.json()
      setVersions(data.versions ?? [])
    } catch { addToast('Failed to load history', 'error') }
    setLoadingV(false)
  }, [resumeId, addToast])

  useEffect(() => { fetchVersions() }, [fetchVersions])

  async function createSnapshot() {
    setSaving(true)
    try {
      const res = await fetch(`/api/resume/${resumeId}/versions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || undefined, parsedData: resumeData, atsScore: analysisResult?.atsScore }),
      })
      if (!res.ok) throw new Error()
      addToast('Snapshot saved ✓', 'success')
      setShowLabel(false); setLabel(''); fetchVersions()
    } catch { addToast('Failed to save snapshot', 'error') }
    setSaving(false)
  }

  async function selectVersion(id: string) {
    if (selectedId === id) { setSelectedId(null); setSelected(null); setDiff(null); return }
    setSelectedId(id); setLoadingD(true); setDiff(null)
    try {
      const res = await fetch(`/api/resume/${resumeId}/versions/${id}`)
      const data = await res.json()
      setSelected(data.version)
      if (byokCreds.apiKey && resumeData) {
        setLoadingDiff(true)
        try {
          const d = await callLLM<DiffResult>({ creds: byokCreds, systemPrompt: VERSION_DIFF_PROMPT,
            userPrompt: `Previous:\n${JSON.stringify(data.version.parsed_data, null, 2)}\n\nCurrent:\n${JSON.stringify(resumeData, null, 2)}` })
          setDiff(d)
        } catch { /* optional */ }
        setLoadingDiff(false)
      }
    } catch { addToast('Failed to load version', 'error') }
    setLoadingD(false)
  }

  async function restore(id: string) {
    setRestoring(true)
    try {
      const res = await fetch(`/api/resume/${resumeId}/versions/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResumeData(data.resume.parsed_data); setAnalysisResult(null)
      addToast(`Restored to "${data.restoredFrom}" ✓`, 'success')
      setSelectedId(null); setSelected(null); setDiff(null); fetchVersions()
    } catch (err) { addToast(err instanceof Error ? err.message : 'Restore failed', 'error') }
    setRestoring(false)
  }

  async function deleteVersion(id: string) {
    setDeletingId(id)
    await fetch(`/api/resume/${resumeId}/versions/${id}`, { method: 'DELETE' })
    setVersions(p => p.filter(v => v.id !== id))
    if (selectedId === id) { setSelectedId(null); setSelected(null); setDiff(null) }
    addToast('Version deleted', 'success')
    setDeletingId(null)
  }

  const scoredV = versions.filter(v => v.ats_score != null).slice(0,10).reverse()

  return (
    <div className="mx-auto px-6 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History size={16} className="text-violet-400"/>
          <h2 className="font-bold text-lg">Version History</h2>
          <span className="text-xs font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{versions.length} snapshot{versions.length !== 1 ? 's' : ''}</span>
        </div>
        {showLabel ? (
          <div className="flex gap-2 items-center">
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (optional)" autoFocus
              onKeyDown={e => e.key === 'Enter' && createSnapshot()}
              className="bg-[#1c1c24] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 w-48"/>
            <Button variant="primary" size="sm" onClick={createSnapshot} loading={savingSnap}>Save</Button>
            <Button size="sm" onClick={() => { setShowLabel(false); setLabel('') }}>Cancel</Button>
          </div>
        ) : (
          <Button variant="primary" size="sm" onClick={() => setShowLabel(true)}><Plus size={13}/>Save Snapshot</Button>
        )}
      </div>

      {/* Score sparkline */}
      {scoredV.length >= 2 && (
        <Card className="mb-6">
          <p className="text-xs font-mono text-slate-500 mb-3">ATS Score Trend</p>
          <div className="flex items-end gap-2 h-14">
            {scoredV.map((v, i) => (
              <div key={v.id} className="flex flex-col items-center gap-1 flex-1">
                <span className={cn('text-xs font-mono', scoreColor(v.ats_score!))}>{Math.round(v.ats_score!)}</span>
                <div className="w-full rounded-sm" style={{
                  height: `${Math.max(6, (v.ats_score!/100)*40)}px`,
                  background: v.ats_score! >= 70 ? '#34d399' : v.ats_score! >= 45 ? '#fbbf24' : '#f87171',
                  opacity: 0.5 + (i/scoredV.length)*0.5,
                }}/>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {(() => {
              const d = Math.round((scoredV[scoredV.length-1]?.ats_score ?? 0) - (scoredV[0]?.ats_score ?? 0))
              if (d > 0)  return <><TrendingUp  size={13} className="text-emerald-400"/><span className="text-xs text-emerald-400">+{d} pts improvement</span></>
              if (d < 0)  return <><TrendingDown size={13} className="text-red-400"/><span className="text-xs text-red-400">{d} pts change</span></>
              return          <><Minus size={13} className="text-slate-500"/><span className="text-xs text-slate-500">Score unchanged</span></>
            })()}
          </div>
        </Card>
      )}

      {/* Empty */}
      {!loadingV && versions.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-white/8 rounded-2xl">
          <GitBranch size={36} className="text-slate-600 mx-auto mb-3"/>
          <p className="font-medium text-slate-400 mb-1">No snapshots yet</p>
          <p className="text-sm text-slate-600 mb-4">Save a snapshot any time you want to preserve the current state of your resume.</p>
          <Button variant="primary" size="sm" onClick={() => setShowLabel(true)}><Plus size={13}/>Save first snapshot</Button>
        </div>
      )}

      {/* Loading */}
      {loadingV && <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" style={{animationDelay:`${i*60}ms`}}/>)}</div>}

      {/* List + detail */}
      {!loadingV && versions.length > 0 && (
        <div className={cn('grid gap-4', selectedId ? 'grid-cols-5' : 'grid-cols-1')}>
          <div className={selectedId ? 'col-span-2' : 'col-span-1'}>
            <div className="space-y-1.5">
              {versions.map((v, i) => (
                <div key={v.id} onClick={() => selectVersion(v.id)}
                  className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all group',
                    selectedId===v.id ? 'border-violet-500/40 bg-violet-500/8' : 'border-white/7 hover:border-white/15 bg-[#16161d]')}>
                  <div className="flex flex-col items-center shrink-0 self-stretch">
                    <div className={cn('w-2 h-2 rounded-full mt-1', i===0 ? 'bg-violet-500' : 'bg-slate-600')}/>
                    {i < versions.length-1 && <div className="w-px flex-1 bg-white/8 mt-1"/>}
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-sm font-medium truncate">{v.label}</p>
                    <p className="text-xs text-slate-500">{formatDate(v.created_at)}</p>
                  </div>
                  {v.ats_score != null && <span className={cn('text-xs font-mono font-bold shrink-0', scoreColor(v.ats_score))}>{Math.round(v.ats_score)}</span>}
                  <button className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                    onClick={e => { e.stopPropagation(); deleteVersion(v.id) }} disabled={deletingId===v.id}>
                    {deletingId===v.id ? <Loader2 size={13} className="spin"/> : <Trash2 size={13}/>}
                  </button>
                  <ChevronRight size={13} className={cn('text-slate-600 shrink-0 transition-transform', selectedId===v.id && 'rotate-90')}/>
                </div>
              ))}
            </div>
          </div>

          {selectedId && (
            <div className="col-span-3 fade-in">
              {loadingD ? (
                <div className="flex items-center justify-center h-40"><Loader2 size={24} className="text-violet-400 spin"/></div>
              ) : selected ? (
                <Card>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold mb-0.5">{selected.label}</h3>
                      <p className="text-xs text-slate-500">{formatDate(selected.created_at)}</p>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => restore(selected.id)} loading={restoring}>
                      <RotateCcw size={13}/>Restore
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      ['Name', selected.parsed_data.name || '—'],
                      ['Experience', `${selected.parsed_data.experience?.length ?? 0} roles`],
                      ['Skills categories', `${selected.parsed_data.skills?.categories?.length ?? 0}`],
                      ['ATS Score', selected.ats_score != null ? String(Math.round(selected.ats_score)) : '—'],
                    ].map(([k,v]) => (
                      <CardSm key={k}>
                        <p className="text-xs font-mono text-slate-500 mb-1">{k}</p>
                        <p className={cn('text-sm', k==='ATS Score' && selected.ats_score != null ? scoreColor(selected.ats_score) : '')}>{v}</p>
                      </CardSm>
                    ))}
                  </div>
                  {loadingDiff ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="spin text-violet-400"/>Generating AI diff…</div>
                  ) : diff ? (
                    <div>
                      <p className="text-xs font-mono text-slate-500 mb-2">Changes vs current version</p>
                      <div className={cn('px-3 py-2.5 rounded-lg mb-3 text-sm border',
                        diff.impact==='positive' ? 'bg-emerald-400/8 border-emerald-400/20 text-emerald-300' :
                        diff.impact==='negative' ? 'bg-red-400/8 border-red-400/20 text-red-300' :
                                                   'bg-white/5 border-white/10 text-slate-300')}>
                        {diff.summary}
                      </div>
                      <div className="space-y-1.5">
                        {diff.changes.map((c, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-xs">
                            <div className={cn('mt-1 shrink-0 w-1.5 h-1.5 rounded-full',
                              c.type==='added' ? 'bg-emerald-400' : c.type==='removed' ? 'bg-red-400' : 'bg-amber-400')}/>
                            <span className="text-slate-500 font-mono capitalize w-20 shrink-0">{c.section}</span>
                            <span className="text-slate-300">{c.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600">Add an API key to generate an AI-powered diff.</p>
                  )}
                </Card>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
