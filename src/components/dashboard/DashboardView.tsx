// src/components/dashboard/DashboardView.tsx
'use client'
// Dashboard: one "next best action" up top (Goal-Gradient + Von Restorff),
// three glanceable stats, then the resume grid. Data loading stays in
// app/(app)/dashboard/page.tsx.
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import NumberFlow from '@number-flow/react'
import { ArrowRight, FileText, Plus, Sparkles, Target, Trophy, Layers, Wand2, Upload } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { scoreHex, scoreWord } from '@/lib/score'
import { DeleteResumeButton } from '@/components/resume/DeleteResumeButton'
import { MiniRing } from '@/components/ui/viz/MiniRing'
import { GlassPanel } from '@/components/ui/glass/GlassPanel'
import { Button } from '@/components/ui/glass/Button'
import { RevealGroup, RevealItem } from '@/components/ui/glass/Reveal'
import { AreaSparkline } from '@/components/vendor/bklit'
import { SPRING } from '@/lib/motion'

export interface DashboardResume {
  id: string
  name: string
  ats_score: number | null
  template_id: string
  updated_at: string
}

const TARGET = 70 // "shortlist-ready" line used across the app

function useGreeting() {
  const [g, setG] = useState('Welcome back')
  useEffect(() => {
    const h = new Date().getHours()
    queueMicrotask(() => setG(h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'))
  }, [])
  return g
}

export function DashboardView({ resumes, scoreTrend }: { resumes: DashboardResume[]; scoreTrend: number[] }) {
  const greeting = useGreeting()
  const scored = resumes.filter(r => r.ats_score != null)
  const avg  = scored.length ? Math.round(scored.reduce((s, r) => s + (r.ats_score ?? 0), 0) / scored.length) : null
  const best = scored.length ? Math.round(Math.max(...scored.map(r => r.ats_score ?? 0))) : null
  const trend = scoreTrend.map((value, i) => ({ i, value }))

  // Next best action: an unscored resume first, otherwise the lowest-scoring one under target.
  const unscored = resumes.find(r => r.ats_score == null)
  const weakest = [...scored].sort((a, b) => (a.ats_score ?? 0) - (b.ats_score ?? 0))[0]
  const focus = unscored ?? (weakest && (weakest.ats_score ?? 0) < TARGET ? weakest : undefined)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-violet-300">{greeting}</p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">Your resumes</h1>
          <p className="mt-2 text-sm text-slate-400">
            {resumes.length === 0 ? 'Upload your first resume to get started.' : `${resumes.length} resume${resumes.length > 1 ? 's' : ''} · open one to keep improving it`}
          </p>
        </div>
        {resumes.length > 0 && (
          <div className="flex gap-2">
            <Button href="/build" variant="secondary" leading={<Wand2 className="size-4" />}>Build</Button>
            <Button href="/upload" magnetic leading={<Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" />}>New resume</Button>
          </div>
        )}
      </div>

      {resumes.length === 0 ? <EmptyState /> : (
        <>
          {/* Next best action */}
          {focus ? <FocusCard resume={focus} /> : <AllGoodCard best={best ?? 0} />}

          {/* Stats */}
          <RevealGroup className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3" each={0.07}>
            <RevealItem><Stat icon={Layers} label="Resumes" value={resumes.length} /></RevealItem>
            <RevealItem><Stat icon={Target} label="Average ATS score" value={avg} accent={avg != null ? scoreHex(avg) : undefined} /></RevealItem>
            <RevealItem>
              <Stat icon={Trophy} label="Best score" value={best} accent={best != null ? scoreHex(best) : undefined}
                extra={trend.length > 1 ? (
                  <div className="w-28">
                    <p className="mb-1 text-right font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Recent runs</p>
                    <AreaSparkline data={trend} dataKey="value" height={36} />
                  </div>
                ) : undefined}
              />
            </RevealItem>
          </RevealGroup>

          {/* Grid */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">All resumes</h2>
            <span className="font-mono text-[11px] text-slate-500">Sorted by last updated</span>
          </div>
          <RevealGroup className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" each={0.05}>
            {resumes.map(r => <RevealItem key={r.id}><ResumeCard resume={r} /></RevealItem>)}
            <RevealItem>
              <Link href="/upload" className="group flex h-full min-h-[184px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/12 text-slate-400 transition-colors hover:border-violet-300/40 hover:bg-violet-500/[0.05] hover:text-white">
                <span className="grid size-12 place-items-center rounded-2xl bg-white/[0.04] transition-[transform,background-color] duration-300 group-hover:scale-110 group-hover:bg-violet-500/20"><Plus className="size-5 transition-transform duration-300 group-hover:rotate-90" /></span>
                <span className="text-sm font-medium">Add another resume</span>
              </Link>
            </RevealItem>
          </RevealGroup>
        </>
      )}
    </div>
  )
}

/* ─── Pieces ─────────────────────────────────────────────────────────────── */

function FocusCard({ resume }: { resume: DashboardResume }) {
  const score = resume.ats_score
  const pct = score == null ? 8 : Math.min(100, (score / TARGET) * 100)
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft} className="mb-6">
      <GlassPanel variant="strong" className="overflow-hidden rounded-3xl p-6 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,.45),transparent)] blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-[radial-gradient(closest-side,rgba(232,121,249,.18),transparent)] blur-2xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex-1">
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-2.5 py-0.5 text-[11px] font-medium text-fuchsia-200">
              <Sparkles className="size-3" />Next best step
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.7rem]">
              {score == null ? <>Score <span className="text-violet-200">{resume.name}</span></> : <>Get <span className="text-violet-200">{resume.name}</span> to shortlist-ready</>}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-slate-300">
              {score == null
                ? 'It hasn’t been analysed yet. Run a score to see where it loses points and the one fix that matters most.'
                : `It scores ${Math.round(score)} — ${TARGET - Math.round(score)} points from the ${TARGET}+ line. Apply the quickest wins in the Score tab.`}
            </p>
            {/* Goal gradient */}
            <div className="mt-5 max-w-md">
              <div className="mb-1.5 flex justify-between font-mono text-[10px] text-slate-400">
                <span>{score == null ? 'Not scored' : `${Math.round(score)} now`}</span><span>{TARGET} shortlist-ready</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-violet-400 to-fuchsia-300 shadow-[0_0_14px_rgba(167,139,250,.7)]"
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ ...SPRING.soft, delay: 0.2 }} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-5">
            {score != null && <MiniRing score={score} size={76} />}
            <Button href={`/resume/${resume.id}`} size="lg" magnetic beam trailing={<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}>
              {score == null ? 'Score it' : 'Improve it'}
            </Button>
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  )
}

function AllGoodCard({ best }: { best: number }) {
  return (
    <GlassPanel variant="subtle" className="mb-6 flex flex-col items-start gap-4 rounded-3xl p-6 sm:flex-row sm:items-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Trophy className="size-5" /></span>
      <div className="flex-1">
        <p className="font-medium text-white">Every resume is shortlist-ready</p>
        <p className="text-sm text-slate-400">Best score {best}. Tailor one to a specific job to push it further.</p>
      </div>
      <Button href="/jobs" variant="secondary" trailing={<ArrowRight className="size-4" />}>Open job tracker</Button>
    </GlassPanel>
  )
}

function Stat({ icon: Icon, label, value, accent, extra }: {
  icon: typeof Layers; label: string; value: number | null; accent?: string; extra?: React.ReactNode
}) {
  return (
    <GlassPanel tilt={4} className="flex h-full items-start justify-between rounded-3xl p-5">
      <div>
        <p className="mb-3 flex items-center gap-2 text-xs text-slate-400"><span className="grid size-7 place-items-center rounded-lg bg-white/[0.06] text-violet-200"><Icon className="size-3.5" /></span>{label}</p>
        <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight" style={{ color: accent ?? '#fff' }}>
          {value === null ? '—' : <NumberFlow value={value} />}
        </p>
      </div>
      {extra}
    </GlassPanel>
  )
}

function ResumeCard({ resume }: { resume: DashboardResume }) {
  const s = resume.ats_score
  return (
    <GlassPanel tilt={5} className="group h-full rounded-3xl p-5 transition-[border-color] duration-300 hover:border-violet-300/25">
      <div className="mb-5 flex items-start gap-3.5">
        {s != null ? <MiniRing score={s} size={52} /> : (
          <div className="grid size-[52px] shrink-0 place-items-center rounded-full border border-dashed border-white/15" title="Not scored yet">
            <FileText size={18} className="text-slate-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 truncate text-[15px] font-semibold text-white">{resume.name}</h3>
          <p className={cn('text-xs', s != null ? '' : 'text-slate-500')} style={s != null ? { color: scoreHex(s) } : undefined}>
            {s != null ? scoreWord(s) : 'Not scored yet'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Updated {formatDate(resume.updated_at)}</p>
        </div>
        <ArrowRight aria-hidden className="size-4 -translate-x-1 text-slate-600 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-violet-300 group-hover:opacity-100" />
      </div>

      <div className="mb-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${s ?? 0}%`, background: s != null ? scoreHex(s) : 'transparent' }} />
      </div>

      <div className="flex items-center justify-between">
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] capitalize text-slate-400">{resume.template_id}</span>
        <div className="relative z-10 opacity-100 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <DeleteResumeButton resumeId={resume.id} />
        </div>
      </div>

      <Link href={`/resume/${resume.id}`} className="absolute inset-0 rounded-3xl" aria-label={`Open ${resume.name}`} />
    </GlassPanel>
  )
}

function EmptyState() {
  return (
    <GlassPanel variant="strong" spotlight={false} className="overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:py-20">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,.45),transparent)] blur-2xl" />
      <div className="relative mx-auto mb-8 h-32 w-40">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="glass absolute inset-x-6 top-0 h-28 rounded-2xl p-3"
            initial={{ y: 30, opacity: 0, rotate: 0 }}
            animate={{ y: i * -8, opacity: 1 - i * 0.25, rotate: (i - 1) * 7, scale: 1 - i * 0.06 }}
            transition={{ ...SPRING.bouncy, delay: 0.15 + i * 0.1 }}
            style={{ zIndex: 3 - i }}
          >
            {i === 0 && (
              <div className="space-y-1.5">
                <div className="h-2 w-1/2 rounded-full bg-violet-300/70" />
                {[90, 75, 82, 60].map(w => <div key={w} className="h-1.5 rounded-full bg-white/15" style={{ width: `${w}%` }} />)}
              </div>
            )}
          </motion.div>
        ))}
      </div>
      <h3 className="relative mb-2 text-2xl font-semibold tracking-tight text-white">Let’s score your first resume</h3>
      <p className="relative mx-auto mb-8 max-w-sm text-sm text-slate-400">Upload a PDF or DOCX for instant section-level scoring with AI suggestions — or build one from scratch.</p>
      <div className="relative flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button href="/upload" size="lg" magnetic beam leading={<Upload className="size-4" />}>Upload resume</Button>
        <Button href="/build" size="lg" variant="secondary" leading={<Wand2 className="size-4" />}>Build from scratch</Button>
      </div>
    </GlassPanel>
  )
}
