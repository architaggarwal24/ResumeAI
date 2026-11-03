'use client'
// src/components/landing/FeatureBento.tsx
// Bento of features where every tile is a tiny working toy — click the chips,
// switch the template, flip the share toggle. Recognition over recall: you see
// the feature behave instead of reading about it.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'motion/react'
import NumberFlow from '@number-flow/react'
import { Check, Plus, Lock, Link2, Eye, Clock, FileDown, History, PenLine } from 'lucide-react'
import { GlassPanel } from '@/components/ui/glass/GlassPanel'
import { Eyebrow } from '@/components/ui/glass/Atoms'
import { RevealGroup, RevealItem, TextReveal } from '@/components/ui/glass/Reveal'
import { useMotionTier } from '@/components/ui/glass/MotionTier'
import { SectionGlow } from '@/components/ui/glass/Ambient'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function FeatureBento() {
  return (
    <section id="features" className="relative isolate mx-auto max-w-6xl scroll-mt-24 px-5 py-28 sm:px-6">
      <SectionGlow side="right" />
      <SectionGlow side="left" tone="a" className="top-[55%]" />
      <div className="mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <Eyebrow>Features</Eyebrow>
          <TextReveal
            text="Everything a recruiter checks. Before they do."
            highlight={['before', 'they', 'do.']}
            className="text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl"
          />
        </div>
        <p className="max-w-sm text-[15px] text-slate-400">Each tile below is live — click around. That is how it feels inside the app.</p>
      </div>

      <RevealGroup className="grid grid-cols-1 gap-4 md:grid-cols-6 [&>*]:min-w-0" each={0.08}>
        <RevealItem className="md:col-span-4"><KeywordTile /></RevealItem>
        <RevealItem className="md:col-span-2"><TemplateTile /></RevealItem>
        <RevealItem className="md:col-span-2"><CoverLetterTile /></RevealItem>
        <RevealItem className="md:col-span-2"><HistoryTile /></RevealItem>
        <RevealItem className="md:col-span-2"><ShareTile /></RevealItem>
        <RevealItem className="md:col-span-4"><ProviderTile /></RevealItem>
        <RevealItem className="md:col-span-2"><ExportTile /></RevealItem>
      </RevealGroup>
    </section>
  )
}

function Tile({ title, body, children, className }: { title: string; body: string; children: React.ReactNode; className?: string }) {
  return (
    <GlassPanel tilt={3} className={cn('flex h-full flex-col rounded-3xl p-6', className)}>
      <div className="mb-5">
        <h3 className="mb-1 text-[17px] font-semibold tracking-tight text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-slate-400">{body}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </GlassPanel>
  )
}

/* 1 — keyword gap (reactive) */
const KW = [
  { k: 'Go', has: true }, { k: 'Kubernetes', has: true }, { k: 'gRPC', has: true }, { k: 'CI/CD', has: true },
  { k: 'Terraform', has: false }, { k: 'Kafka', has: false }, { k: 'Observability', has: false },
]
function KeywordTile() {
  const [added, setAdded] = useState<Set<string>>(new Set())
  const matched = KW.filter(x => x.has || added.has(x.k)).length
  const pct = Math.round((matched / KW.length) * 100)
  const toggle = (k: string) => setAdded(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <Tile title="ATS keyword match" body="Paste a job post and see exactly which keywords you are missing. Tap a missing one to add it.">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative grid size-28 shrink-0 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7" />
            <motion.circle cx="50" cy="50" r="42" fill="none" stroke={pct === 100 ? '#e879f9' : '#8b5cf6'} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={264} initial={false} animate={{ strokeDashoffset: 264 * (1 - pct / 100) }} transition={SPRING.soft} />
          </svg>
          <div className="text-center">
            <p className="font-mono text-2xl font-semibold text-white"><NumberFlow value={pct} suffix="%" /></p>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">match</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {KW.map(({ k, has }) => {
            const on = has || added.has(k)
            return (
              <motion.button
                key={k}
                type="button"
                layout
                disabled={has}
                onClick={() => toggle(k)}
                whileTap={{ scale: 0.92 }}
                transition={SPRING.snappy}
                aria-pressed={on}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 font-mono text-xs transition-colors',
                  has ? 'cursor-default border-violet-300/30 bg-violet-400/12 text-violet-100'
                    : on ? 'border-fuchsia-300/45 bg-fuchsia-300/15 text-fuchsia-100'
                    : 'border-dashed border-red-400/40 bg-red-400/[0.07] text-red-200 hover:border-red-300/70 hover:bg-red-400/[0.12]',
                )}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={on ? 'y' : 'n'} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={SPRING.bouncy}>
                    {on ? <Check className="size-3" strokeWidth={3} /> : <Plus className="size-3" strokeWidth={3} />}
                  </motion.span>
                </AnimatePresence>
                {k}
              </motion.button>
            )
          })}
        </div>
      </div>
    </Tile>
  )
}

/* 2 — templates (click to switch) */
const TEMPLATES = ['Modern', 'Classic', 'Minimal', 'Executive'] as const
function TemplateTile() {
  const [t, setT] = useState<(typeof TEMPLATES)[number]>('Modern')
  return (
    <Tile title="Four templates" body="Switch the look without touching the content.">
      <div className="mb-3 flex justify-center">
        <AnimatePresence mode="wait">
          <motion.div key={t} initial={{ opacity: 0, rotateY: -50, scale: 0.9 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} exit={{ opacity: 0, rotateY: 50, scale: 0.9 }} transition={SPRING.soft}
            className="h-32 w-24 rounded-lg bg-slate-100 p-2 shadow-[0_20px_40px_-12px_rgba(0,0,0,.8)] [transform-style:preserve-3d]">
            <MiniSheet kind={t} />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="relative grid grid-cols-4 gap-1 rounded-xl bg-white/[0.04] p-1">
        {TEMPLATES.map(name => (
          <button key={name} type="button" onClick={() => setT(name)} aria-pressed={t === name}
            className={cn('relative min-h-9 rounded-lg text-[11px] transition-colors', t === name ? 'text-ink' : 'text-slate-400 hover:text-slate-200')}>
            {t === name && <motion.span layoutId="tpl-pill" transition={SPRING.snappy} className="absolute inset-0 rounded-lg bg-violet-300" />}
            <span className="relative">{name}</span>
          </button>
        ))}
      </div>
    </Tile>
  )
}
function MiniSheet({ kind }: { kind: (typeof TEMPLATES)[number] }) {
  const accent = kind === 'Modern' ? 'bg-violet-600' : kind === 'Classic' ? 'bg-slate-800' : kind === 'Minimal' ? 'bg-slate-400' : 'bg-fuchsia-500'
  return (
    <div className={cn('flex h-full gap-1.5', kind === 'Classic' && 'flex-col items-center')}>
      {kind === 'Modern' && <div className="w-5 rounded-sm bg-violet-700/80" />}
      <div className="flex flex-1 flex-col gap-1">
        <div className={cn('h-1.5 w-3/4 rounded-full', accent, kind === 'Classic' && 'mx-auto')} />
        <div className="h-1 w-1/2 rounded-full bg-slate-300" />
        {Array.from({ length: kind === 'Executive' ? 8 : 6 }).map((_, i) => (
          <div key={i} className={cn('h-1 rounded-full bg-slate-300', i % 3 === 0 && 'mt-1 w-1/3 bg-slate-500', i % 3 !== 0 && 'w-full')} />
        ))}
      </div>
    </div>
  )
}

/* 3 — cover letter (typing) */
const LETTER = 'Dear hiring team — your platform team’s move to gRPC is exactly the migration I led at Northwind, where we cut p99 latency by 38%…'
function CoverLetterTile() {
  const tier = useMotionTier()
  const [n, setN] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  useEffect(() => {
    // Types only while visible: 2 characters per 64ms tick ≈ the old speed with half the renders.
    if (tier === 'off' || !inView) return
    const id = window.setInterval(() => { if (!document.hidden) setN(v => (v >= LETTER.length + 30 ? 0 : v + 2)) }, 64)
    return () => window.clearInterval(id)
  }, [tier, inView])
  const shown = tier === 'off' ? LETTER : LETTER.slice(0, n)
  return (
    <Tile title="Cover letters" body="Written from your resume and the job post, in your voice.">
      <div ref={ref} className="min-h-[7.5rem] rounded-xl border border-white/8 bg-black/25 p-3.5 text-[13px] leading-relaxed text-slate-300">
        <PenLine className="mb-2 size-3.5 text-violet-300" />
        <span className="caret">{shown}</span>
      </div>
    </Tile>
  )
}

/* 4 — version history */
const VERSIONS = [
  { label: 'Tailored · Stripe', score: 91, t: '2m ago' },
  { label: 'Quantified bullets', score: 84, t: '1h ago' },
  { label: 'Original upload', score: 68, t: 'Yesterday' },
]
function HistoryTile() {
  const [sel, setSel] = useState(0)
  return (
    <Tile title="Version history" body="Every change is snapshotted. Restore any version in one click.">
      <ul className="relative space-y-1">
        <span aria-hidden className="absolute bottom-3 left-[11px] top-3 w-px bg-white/10" />
        {VERSIONS.map((v, i) => (
          <li key={v.label}>
            <button type="button" onClick={() => setSel(i)} aria-pressed={sel === i}
              className={cn('relative flex min-h-11 w-full items-center gap-3 rounded-xl px-1.5 text-left transition-colors', sel === i ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]')}>
              <span className={cn('relative z-10 grid size-[18px] place-items-center rounded-full border-2', sel === i ? 'border-violet-300 bg-violet-400/30' : 'border-white/20 bg-ink')}>
                {sel === i && <motion.span layoutId="ver-dot" className="size-1.5 rounded-full bg-violet-200" transition={SPRING.snappy} />}
              </span>
              <span className="flex-1">
                <span className="block text-[13px] text-slate-200">{v.label}</span>
                <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500"><Clock className="size-2.5" />{v.t}</span>
              </span>
              <span className="font-mono text-sm text-slate-300">{v.score}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><History className="size-3" />Current version is auto-snapshotted before a restore.</p>
    </Tile>
  )
}

/* 5 — share links (toggle) */
function ShareTile() {
  const [locked, setLocked] = useState(true)
  return (
    <Tile title="Private share links" body="Password, expiry and view counts. Revoke any time.">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-slate-400">
        <Link2 className="size-3.5 shrink-0 text-violet-300" />
        <span className="truncate font-mono">resumeai.app/s/k3Fq9…</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={String(locked)} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={SPRING.bouncy} className="ml-auto">
            <Lock className={cn('size-3.5', locked ? 'text-fuchsia-300' : 'text-slate-600')} />
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><Eye className="size-3" />14 views · expires in 6 days</span>
        <button type="button" role="switch" aria-checked={locked} aria-label="Password protect link" onClick={() => setLocked(l => !l)}
          className={cn('relative h-7 w-12 rounded-full border transition-colors duration-300', locked ? 'border-fuchsia-300/40 bg-fuchsia-300/25' : 'border-white/10 bg-white/[0.06]')}>
          <motion.span layout transition={SPRING.snappy} className={cn('absolute top-1/2 size-5 -translate-y-1/2 rounded-full shadow-md', locked ? 'right-1 bg-fuchsia-200' : 'left-1 bg-slate-400')} />
        </button>
      </div>
    </Tile>
  )
}

/* 6 — providers (segmented control) */
const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', model: 'Claude' },
  { id: 'openai', name: 'OpenAI', model: 'GPT' },
  { id: 'gemini', name: 'Gemini', model: 'Gemini' },
  { id: 'openrouter', name: 'OpenRouter', model: '300+ models' },
  { id: 'nvidia', name: 'NVIDIA NIM', model: 'Llama · Nemotron' },
]
function ProviderTile() {
  const [p, setP] = useState(PROVIDERS[0].id)
  const cur = PROVIDERS.find(x => x.id === p)!
  return (
    <Tile title="Five AI providers. Your key." body="Bring the model you already pay for. Switch any time — your key lives only in this browser tab.">
      <div className="flex flex-wrap gap-1 rounded-2xl bg-white/[0.04] p-1">
        {PROVIDERS.map(x => (
          <button key={x.id} type="button" onClick={() => setP(x.id)} aria-pressed={p === x.id}
            className={cn('relative min-h-10 flex-1 rounded-xl px-3 text-[13px] transition-colors', p === x.id ? 'text-white' : 'text-slate-400 hover:text-slate-200')}>
            {p === x.id && <motion.span layoutId="prov-pill" transition={SPRING.snappy} className="absolute inset-0 rounded-xl border border-violet-300/30 bg-violet-400/15 shadow-[0_0_20px_-6px_rgba(139,92,246,.7)]" />}
            <span className="relative whitespace-nowrap">{x.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/8 bg-black/25 px-4 py-3">
        <span className="relative flex size-2"><span className="absolute inset-0 animate-[ping-soft_1.8s_ease-out_infinite] rounded-full bg-emerald-400" /><span className="relative size-2 rounded-full bg-emerald-400" /></span>
        <AnimatePresence mode="wait">
          <motion.span key={p} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="font-mono text-xs text-slate-300">
            connected · {cur.model}
          </motion.span>
        </AnimatePresence>
        <span className="ml-auto font-mono text-[10px] text-slate-500">key: sessionStorage</span>
      </div>
    </Tile>
  )
}

/* 7 — export */
function ExportTile() {
  const [done, setDone] = useState<string | null>(null)
  return (
    <Tile title="Export anywhere" body="Pixel-clean PDF, editable DOCX, or LaTeX source.">
      <div className="grid grid-cols-3 gap-2">
        {['PDF', 'DOCX', 'LaTeX'].map(f => (
          <motion.button key={f} type="button" whileTap={{ scale: 0.94 }} whileHover={{ y: -2 }} transition={SPRING.snappy}
            onClick={() => { setDone(f); window.setTimeout(() => setDone(d => (d === f ? null : d)), 1400) }}
            className="glass-subtle flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs text-slate-200 hover:border-violet-300/30">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={done === f ? 'ok' : 'dl'} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} transition={SPRING.bouncy}>
                {done === f ? <Check className="size-4 text-violet-300" strokeWidth={3} /> : <FileDown className="size-4 text-slate-400" />}
              </motion.span>
            </AnimatePresence>
            <span className="font-mono">{f}</span>
          </motion.button>
        ))}
      </div>
    </Tile>
  )
}
