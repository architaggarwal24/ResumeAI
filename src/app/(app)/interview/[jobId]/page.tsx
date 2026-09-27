// src/app/(app)/interview/[jobId]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useResumeStore } from '@/store/resumeStore'
import { Button, Card } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import {
  MessageSquare, ChevronDown, ChevronUp, CheckSquare, Square,
  Sparkles, AlertTriangle, Star, Lightbulb, ArrowLeft,
  Loader2
} from 'lucide-react'
import type { InterviewPrepResult, InterviewQuestion, QuestionType } from '@/types/resume'

const TYPE_STYLES: Record<QuestionType, { label: string; color: string; bg: string }> = {
  behavioral:  { label: 'Behavioral',  color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/20'    },
  technical:   { label: 'Technical',   color: 'text-violet-400',  bg: 'bg-violet-400/10 border-violet-400/20' },
  situational: { label: 'Situational', color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20'  },
  culture:     { label: 'Culture Fit', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20'},
}

const DIFF_STYLES = {
  easy:   'text-emerald-400',
  medium: 'text-amber-400',
  hard:   'text-red-400',
}

export default function InterviewPrepPage() {
  const params    = useParams()
  const router    = useRouter()
  const jobId     = params.jobId as string
  const { byokCreds, addToast } = useResumeStore()

  const [job, setJob]           = useState<{ company: string; role: string; notes: string | null; resume_id: string | null } | null>(null)
  const [resumes, setResumes]   = useState<{ id: string; name: string }[]>([])
  const [selectedResume, setSelectedResume] = useState('')
  const [jd, setJd]             = useState('')
  const [result, setResult]     = useState<InterviewPrepResult | null>(null)
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [loading, setLoading]   = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterType, setFilter] = useState<QuestionType | 'all'>('all')

  useEffect(() => {
    async function load() {
      const [jr, rr] = await Promise.all([
        fetch('/api/jobs').then(r => r.json()),
        fetch('/api/resume').then(r => r.json()),
      ])
      const foundJob = jr.jobs?.find((j: { id: string }) => j.id === jobId)
      if (foundJob) {
        setJob(foundJob)
        setJd(foundJob.notes || '')
        if (foundJob.resume_id) setSelectedResume(foundJob.resume_id)
      }
      setResumes(rr.resumes ?? [])
      if (rr.resumes?.[0] && !foundJob?.resume_id) setSelectedResume(rr.resumes[0].id)
      setInitialLoad(false)
    }
    load()
  }, [jobId])

  async function generate() {
    if (!selectedResume || !jd.trim() || !byokCreds.apiKey) {
      addToast('Need API key, resume, and job description', 'error'); return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: selectedResume, jobDescription: jd,
          company: job?.company, role: job?.role, creds: byokCreds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.result)
      setQuestions(data.result.questions)
      addToast(`${data.result.questions.length} questions generated`, 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed', 'error')
    }
    setLoading(false)
  }

  function toggleCheck(id: string) {
    setQuestions(p => p.map(q => q.id === id ? { ...q, checked: !q.checked } : q))
  }

  const filteredQ = filterType === 'all' ? questions : questions.filter(q => q.type === filterType)
  const checkedCount = questions.filter(q => q.checked).length

  if (initialLoad) return (
    <div className="p-8 flex items-center justify-center h-full">
      <Loader2 size={32} className="text-violet-400 spin" />
    </div>
  )

  return (
    <div className="mx-auto px-8 py-8 max-w-4xl fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/jobs')} className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare size={20} className="text-violet-400" />Interview Prep
          </h1>
          {job && <p className="text-slate-400 text-sm mt-0.5">{job.role} @ {job.company}</p>}
        </div>
      </div>

      {/* Setup */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5 block">Resume to use</label>
            <select value={selectedResume} onChange={e => setSelectedResume(e.target.value)}
              className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50">
              {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="primary" className="w-full justify-center" onClick={generate} loading={loading}
              disabled={!selectedResume || !jd.trim()}>
              <Sparkles size={13} />{loading ? 'Generating…' : result ? 'Regenerate' : 'Generate Prep Guide'}
            </Button>
          </div>
        </div>
        <div>
          <label className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5 block">Job Description</label>
          <textarea rows={5} value={jd} onChange={e => setJd(e.target.value)}
            placeholder="Paste the full job description here…"
            className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none" />
        </div>
      </Card>

      {result && (
        <div className="space-y-6 fade-in">
          {/* Key talking points */}
          {result.keyTalkingPoints?.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Star size={14} className="text-amber-400" />
                <p className="text-sm font-semibold">Key Talking Points</p>
              </div>
              <div className="space-y-2">
                {result.keyTalkingPoints.map((pt, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="text-amber-400 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                    <span className="text-slate-300">{pt}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Red flags */}
          {result.redFlags?.length > 0 && (
            <div className="px-4 py-3 bg-red-400/8 border border-red-400/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-sm font-semibold text-red-300">Likely Probe Areas</p>
              </div>
              <ul className="space-y-1">
                {result.redFlags.map((rf, i) => (
                  <li key={i} className="text-xs text-red-300/80 flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">•</span>{rf}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prep checklist */}
          {result.prepChecklist?.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={14} className="text-violet-400" />
                <p className="text-sm font-semibold">Prep Checklist</p>
              </div>
              <div className="space-y-2">
                {result.prepChecklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <span className="text-violet-400/60 mt-0.5 shrink-0">☐</span>
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Questions</p>
                <span className="text-xs font-mono text-slate-500">{checkedCount}/{questions.length} reviewed</span>
              </div>
              {/* Type filter */}
              <div className="flex gap-1">
                {(['all', 'behavioral', 'technical', 'situational', 'culture'] as const).map(t => (
                  <button key={t} onClick={() => setFilter(t)}
                    className={cn('px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize',
                      filterType === t ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {filteredQ.map((q) => (
                <div key={q.id}
                  className={cn('border rounded-xl overflow-hidden transition-all',
                    q.checked ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/7 bg-[#16161d]')}>
                  <div className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
                    <button className={cn('mt-0.5 shrink-0', q.checked ? 'text-emerald-400' : 'text-slate-600')}
                      onClick={e => { e.stopPropagation(); toggleCheck(q.id) }}>
                      {q.checked ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    <p className="flex-1 text-sm text-slate-200 leading-relaxed">{q.question}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('text-xs', DIFF_STYLES[q.difficulty])}>{q.difficulty}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-mono',
                        TYPE_STYLES[q.type].color, TYPE_STYLES[q.type].bg)}>
                        {TYPE_STYLES[q.type].label}
                      </span>
                      {expanded === q.id ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
                    </div>
                  </div>

                  {expanded === q.id && (
                    <div className="px-4 pb-4 border-t border-white/7 pt-3 space-y-3 fade-in">
                      <div className="bg-violet-500/8 border border-violet-500/15 rounded-lg px-3 py-2.5">
                        <p className="text-xs font-mono text-violet-400 mb-1.5">Model Answer</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{q.modelAnswer}</p>
                      </div>
                      {q.resumeEvidence && (
                        <div className="flex items-start gap-2 text-xs text-slate-500">
                          <FileTextIcon />
                          <span>Cite: <em className="text-slate-400">{q.resumeEvidence}</em></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FileTextIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
      <path strokeLinecap="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  )
}
