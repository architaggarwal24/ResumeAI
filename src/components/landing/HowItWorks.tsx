'use client'
// src/components/landing/HowItWorks.tsx
// Scroll story: a sticky glass stage on the left swaps its scene as you scroll
// through four steps on the right. A rail fills as you go (Goal-Gradient);
// four steps only (Miller). Mobile stacks each scene under its step.
import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { FileUp, Gauge, Wand2, MessagesSquare, FileText, Check } from 'lucide-react'
import { GlassPanel } from '@/components/ui/glass/GlassPanel'
import { Eyebrow } from '@/components/ui/glass/Atoms'
import { TextReveal } from '@/components/ui/glass/Reveal'
import { SectionGlow } from '@/components/ui/glass/Ambient'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

const STEPS = [
  { icon: FileUp, title: 'Drop in your resume', body: 'PDF or DOCX. It is parsed into clean, editable sections in seconds — nothing to retype.', scene: <UploadScene /> },
  { icon: Gauge, title: 'See your real score', body: 'Every section is scored with the reason it lost points and a one-line fix, ranked by impact.', scene: <ScoreScene /> },
  { icon: Wand2, title: 'Tailor it to the job', body: 'Paste a job post. Missing keywords surface, bullets get rewritten to match — your original is snapshotted first.', scene: <TailorScene /> },
  { icon: MessagesSquare, title: 'Rehearse the interview', body: 'A mock interviewer that has read your resume asks the hard follow-ups and rates each answer.', scene: <InterviewScene /> },
]

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 60%', 'end 60%'] })
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 })
  useMotionValueEvent(scrollYProgress, 'change', v => setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)))))

  return (
    <section id="how" className="relative isolate mx-auto max-w-6xl scroll-mt-24 px-5 py-28 sm:px-6">
      <SectionGlow side="left" />
      <div className="mb-16 max-w-2xl">
        <Eyebrow>How it works</Eyebrow>
        <TextReveal
          text="From first draft to “let’s talk” in four steps."
          highlight={['let’s', 'talk']}
          className="text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl"
        />
      </div>

      <div ref={ref} className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* Sticky stage (desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-28">
            <GlassPanel variant="strong" className="aspect-[4/3.4] overflow-hidden rounded-3xl p-8">
              <div aria-hidden className="dot-bg absolute inset-0 rounded-[inherit] opacity-40 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)]" />
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Step {active + 1} / {STEPS.length}</span>
                <div className="flex gap-1.5">
                  {STEPS.map((_, i) => (
                    <motion.span key={i} className="h-1.5 rounded-full" animate={{ width: i === active ? 22 : 6, backgroundColor: i <= active ? '#8b5cf6' : 'rgba(255,255,255,.15)' }} transition={SPRING.snappy} />
                  ))}
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, transition: { duration: 0.18 } }}
                  transition={SPRING.soft}
                  className="relative"
                >
                  {STEPS[active].scene}
                </motion.div>
              </AnimatePresence>
            </GlassPanel>
          </div>
        </div>

        {/* Steps */}
        <div className="relative">
          <div aria-hidden className="absolute bottom-6 left-[22px] top-6 w-px bg-white/[0.08]">
            <motion.div className="h-full w-full origin-top bg-gradient-to-b from-violet-300 via-violet-400 to-fuchsia-300" style={{ scaleY: fill }} />
          </div>
          <ol className="space-y-6 lg:space-y-0">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative pl-16 lg:flex lg:min-h-[62vh] lg:items-center">
                <motion.span
                  className="absolute left-0 top-0 grid size-11 place-items-center rounded-2xl border lg:top-1/2 lg:-translate-y-1/2"
                  animate={i <= active
                    ? { backgroundColor: 'rgba(139,92,246,.16)', borderColor: 'rgba(167,139,250,.45)', color: '#c4b5fd', boxShadow: '0 0 24px -4px rgba(139,92,246,.6)' }
                    : { backgroundColor: 'rgba(14,11,19,.9)', borderColor: 'rgba(255,255,255,.1)', color: '#64748b', boxShadow: '0 0 0 0 rgba(0,0,0,0)' }}
                  transition={SPRING.soft}
                >
                  <s.icon className="size-5" />
                </motion.span>
                <div className={cn('transition-opacity duration-500 lg:max-w-md', i === active ? 'lg:opacity-100' : 'lg:opacity-40')}>
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">0{i + 1}</p>
                  <h3 className="mb-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{s.title}</h3>
                  <p className="text-[15px] leading-relaxed text-slate-400">{s.body}</p>
                  <div className="mt-6 lg:hidden">
                    <GlassPanel variant="strong" className="overflow-hidden rounded-2xl p-5">{s.scene}</GlassPanel>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ─── Scenes ─────────────────────────────────────────────────────────────── */

function SceneTitle({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-sm font-medium text-slate-300">{children}</p>
}

function UploadScene() {
  return (
    <div>
      <SceneTitle>Importing resume…</SceneTitle>
      <div className="relative grid h-40 place-items-center rounded-2xl border border-dashed border-violet-300/30 bg-violet-400/[0.04]">
        <motion.div
          initial={{ y: -40, rotate: -8, opacity: 0 }}
          animate={{ y: 0, rotate: -3, opacity: 1 }}
          transition={{ ...SPRING.bouncy, delay: 0.1 }}
          className="glass flex items-center gap-3 rounded-xl px-4 py-3"
        >
          <FileText className="size-6 text-violet-300" />
          <div>
            <p className="text-sm text-white">alex_chen_resume.pdf</p>
            <p className="font-mono text-[10px] text-slate-500">184 KB</p>
          </div>
        </motion.div>
      </div>
      <div className="mt-5 space-y-2.5">
        {['Reading PDF', 'Finding sections', 'Structuring bullets'].map((t, i) => (
          <motion.div key={t} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.25 }} className="flex items-center gap-2.5 text-[13px] text-slate-300">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.bouncy, delay: 0.5 + i * 0.25 }} className="grid size-4 place-items-center rounded-full bg-violet-400/20 text-violet-200">
              <Check className="size-2.5" strokeWidth={3} />
            </motion.span>
            {t}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const SECTIONS = [
  { label: 'Experience', value: 88 },
  { label: 'Education', value: 84 },
  { label: 'Skills', value: 79 },
  { label: 'Projects', value: 72 },
  { label: 'Summary', value: 61 },
]

function ScoreScene() {
  return (
    <div>
      <SceneTitle>Section scores</SceneTitle>
      <div className="space-y-3.5">
        {SECTIONS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-20 text-[13px] text-slate-400">{s.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className={cn('h-full rounded-full', s.value >= 70 ? 'bg-gradient-to-r from-violet-500 to-violet-300' : 'bg-gradient-to-r from-fuchsia-500 to-fuchsia-300')}
                initial={{ width: 0 }} animate={{ width: `${s.value}%` }}
                transition={{ ...SPRING.soft, delay: 0.08 * i }}
              />
            </div>
            <span className="w-8 text-right font-mono text-[13px] tabular-nums text-slate-200">{s.value}</span>
          </div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-6 rounded-xl border border-fuchsia-300/25 bg-fuchsia-300/[0.07] px-4 py-3">
        <p className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-fuchsia-300">Summary · quickest win</p>
        <p className="text-[13px] text-slate-200">Lead with your strongest result, not your job title.</p>
      </motion.div>
    </div>
  )
}

function TailorScene() {
  return (
    <div>
      <SceneTitle>Matching to “Senior Backend Engineer”</SceneTitle>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {[['Kubernetes', 1], ['Go', 1], ['gRPC', 1], ['CI/CD', 1], ['Terraform', 0], ['Kafka', 0]].map(([k, ok], i) => (
          <motion.span
            key={k as string}
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING.bouncy, delay: 0.05 * i }}
            className={cn('rounded-full border px-2.5 py-1 font-mono text-[11px]', ok ? 'border-violet-300/35 bg-violet-400/12 text-violet-100' : 'border-red-400/30 bg-red-400/10 text-red-300')}
          >
            {ok ? '✓' : '+'} {k}
          </motion.span>
        ))}
      </div>
      <div className="space-y-2 text-[13px]">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="rounded-lg bg-red-400/[0.07] px-3 py-2.5 text-slate-500 line-through decoration-red-400/50">Worked on backend services and infrastructure</motion.p>
        <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.soft, delay: 0.55 }} className="rounded-lg border border-violet-300/20 bg-violet-400/[0.08] px-3 py-2.5 text-slate-100">
          Cut API latency 38% across 12 Go services on Kubernetes, shipped via CI/CD
        </motion.p>
      </div>
    </div>
  )
}

function InterviewScene() {
  return (
    <div className="space-y-3 text-[13px]">
      <SceneTitle>Mock interview · Backend</SceneTitle>
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-2.5 text-slate-200">
        You cut latency 38%. What did you measure first, and why?
      </motion.p>
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-violet-500/25 px-4 py-2.5 text-violet-50">
        p99 per endpoint — the tail was where users felt it…
      </motion.p>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING.bouncy, delay: 0.8 }} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
        <span className="font-mono text-2xl font-semibold text-violet-200">8.5</span>
        <span className="text-slate-400">/ 10 — clear metric, add the trade-off you made.</span>
      </motion.div>
    </div>
  )
}
