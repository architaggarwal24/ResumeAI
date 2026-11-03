'use client'
// src/components/landing/LandingSections.tsx
// Privacy flow, stats band, FAQ accordion, closing CTA and footer.
import { useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'motion/react'
import NumberFlow from '@number-flow/react'
import { ArrowRight, ChevronDown, Globe, KeyRound, Monitor, Server, ShieldCheck, Trash2, EyeOff } from 'lucide-react'
import { GlassPanel } from '@/components/ui/glass/GlassPanel'
import { Button } from '@/components/ui/glass/Button'
import { Eyebrow, Marquee } from '@/components/ui/glass/Atoms'
import { Reveal, RevealGroup, RevealItem, TextReveal } from '@/components/ui/glass/Reveal'
import { AuroraBackdrop, SectionGlow } from '@/components/ui/glass/Ambient'
import { Logo } from './LandingNav'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ─── Providers marquee ──────────────────────────────────────────────────── */
export function ProviderMarquee() {
  const names = ['Anthropic', 'OpenAI', 'Google Gemini', 'OpenRouter', 'NVIDIA NIM']
  return (
    <section aria-label="Supported AI providers" className="relative border-y border-white/[0.06] bg-white/[0.012] py-7">
      <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">Works with the model you already pay for</p>
      <Marquee duration={28}>
        {names.map(n => (
          <span key={n} className="mx-3 flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-500 transition-colors hover:text-white sm:mx-5 sm:text-3xl">
            <span aria-hidden className="text-base text-fuchsia-300/70">✦</span>{n}
          </span>
        ))}
      </Marquee>
    </section>
  )
}

/* ─── Stats ──────────────────────────────────────────────────────────────── */
const STATS = [
  { n: 5, label: 'AI providers' },
  { n: 4, label: 'Resume templates' },
  { n: 3, label: 'Export formats' },
  { n: 0, label: 'Keys stored on our servers', accent: true },
]
export function StatsBand() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px' })
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
      <div ref={ref} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATS.map((s, i) => (
          <GlassPanel key={s.label} variant="subtle" className={cn('rounded-2xl p-6 text-center', s.accent && 'border-fuchsia-300/20')}>
            <p className={cn('font-mono text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl', s.accent ? 'text-fuchsia-300' : 'text-white')}>
              <NumberFlow value={inView ? s.n : s.accent ? 99 : 0} transformTiming={{ duration: 900 + i * 150, easing: 'cubic-bezier(.16,1,.3,1)' }} />
            </p>
            <p className="mt-2 text-[13px] text-slate-400">{s.label}</p>
          </GlassPanel>
        ))}
      </div>
    </section>
  )
}

/* ─── Privacy flow ───────────────────────────────────────────────────────── */
const NODES = [
  { icon: Monitor, title: 'Your browser tab', note: 'Key held in sessionStorage. Closing the tab forgets it.' },
  { icon: Server, title: 'ResumeAI relay', note: 'Forwards that one request to your provider. The key is never saved.' },
  { icon: Globe, title: 'Your AI provider', note: 'Bills you directly — typically cents per analysis.' },
]
export function PrivacyFlow() {
  return (
    <section id="privacy" className="relative isolate mx-auto max-w-6xl scroll-mt-24 px-5 py-28 sm:px-6">
      <SectionGlow side="center" tone="a" />
      <div className="mb-14 grid gap-8 md:grid-cols-2 md:items-end">
        <div>
          <Eyebrow>Privacy by design</Eyebrow>
          <TextReveal text="Your API key stays yours." highlight={['yours.', 'yours']} highlightClassName="text-fuchsia-300" className="text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl" />
        </div>
        <p className="text-[15px] leading-relaxed text-slate-400 md:justify-self-end md:text-right">
          Bring-your-own-key means there is no account-wide AI bill to protect, no key vault to breach, and nothing to cancel.
        </p>
      </div>

      <div className="relative">
        {/* Beam connecting the nodes (desktop) */}
        <svg aria-hidden className="absolute left-0 top-[52px] hidden h-2 w-full md:block" preserveAspectRatio="none" viewBox="0 0 100 2">
          <line x1="16" y1="1" x2="84" y2="1" stroke="rgba(255,255,255,.08)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          <motion.line x1="16" y1="1" x2="84" y2="1" stroke="url(#beam-g)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round"
            strokeDasharray="8 92" pathLength={100}
            animate={{ strokeDashoffset: [100, 0] }} transition={{ duration: 2.4, ease: 'linear', repeat: Infinity }} />
          <defs>
            <linearGradient id="beam-g" x1="0" x2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#e879f9" /></linearGradient>
          </defs>
        </svg>

        <RevealGroup className="relative grid gap-4 md:grid-cols-3" each={0.12}>
          {NODES.map((n, i) => (
            <RevealItem key={n.title}>
              <div className="flex flex-col items-center text-center">
                <div className={cn('relative mb-5 grid size-[104px] place-items-center rounded-[28px]', i === 1 ? 'glass-strong no-blur' : 'glass')}>
                  <span className="edge" />
                  {i === 0 && <KeyRound aria-hidden className="absolute -right-2 -top-2 size-7 rounded-full bg-fuchsia-300 p-1.5 text-ink shadow-[0_0_18px_rgba(232,121,249,.7)]" />}
                  <n.icon className={cn('size-9', i === 1 ? 'text-violet-200' : 'text-slate-200')} strokeWidth={1.5} />
                </div>
                <h3 className="mb-1.5 text-lg font-semibold text-white">{n.title}</h3>
                <p className="max-w-[16rem] text-sm text-slate-400">{n.note}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>

      <RevealGroup className="mt-14 grid gap-3 sm:grid-cols-3" each={0.08}>
        {[
          { icon: ShieldCheck, t: 'Share links you control', d: 'Optional password and expiry, revoke any time.' },
          { icon: EyeOff, t: 'Private by default', d: 'Nothing is public unless you create a link.' },
          { icon: Trash2, t: 'Delete everything', d: 'One action in Settings wipes all your data.' },
        ].map(x => (
          <RevealItem key={x.t}>
            <GlassPanel variant="subtle" className="flex h-full gap-3.5 rounded-2xl p-5">
              <x.icon className="mt-0.5 size-5 shrink-0 text-violet-300" />
              <div>
                <p className="text-sm font-medium text-white">{x.t}</p>
                <p className="mt-0.5 text-[13px] text-slate-400">{x.d}</p>
              </div>
            </GlassPanel>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  )
}

/* ─── FAQ ────────────────────────────────────────────────────────────────── */
const FAQ = [
  { q: 'What does it cost?', a: 'The app is free. You bring your own API key, so you pay your AI provider directly for what you use — typically a few cents per analysis.' },
  { q: 'Which AI providers work?', a: 'Anthropic, OpenAI, Google Gemini, OpenRouter and NVIDIA NIM. Pick the model you prefer in Settings.' },
  { q: 'Where does my API key live?', a: 'In your browser tab only (sessionStorage). It is never saved to our database. Each AI request is relayed through our server to your provider so it can work, and the key is used for that request alone.' },
  { q: 'Can I export my resume?', a: 'Yes — PDF, DOCX and LaTeX, across four templates.' },
  { q: 'Is my resume public?', a: 'No. It is only visible through share links you create yourself — each can have a password and an expiry, and you can revoke it any time.' },
  { q: 'Can I delete everything?', a: 'Yes. Delete individual resumes from the dashboard, or wipe all your data from Settings.' },
]
export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="cv-auto mx-auto max-w-3xl scroll-mt-24 px-5 py-28 sm:px-6">
      <div className="mb-12 text-center">
        <Eyebrow className="justify-center">FAQ</Eyebrow>
        <TextReveal text="Questions, answered." className="text-4xl font-semibold tracking-tight text-white sm:text-5xl" />
      </div>
      <Reveal>
        <GlassPanel spotlight={false} className="divide-y divide-white/[0.06] rounded-3xl p-2">
          {FAQ.map((f, i) => {
            const isOpen = open === i
            const id = `faq-${i}`
            return (
              <div key={f.q} className="relative">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className={cn('text-[15px] font-medium transition-colors', isOpen ? 'text-white' : 'text-slate-300')}>{f.q}</span>
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={SPRING.snappy}
                    className={cn('grid size-8 shrink-0 place-items-center rounded-full border transition-colors', isOpen ? 'border-violet-300/40 bg-violet-400/15 text-violet-200' : 'border-white/10 text-slate-500')}>
                    <ChevronDown className="size-4" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div id={id} role="region" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ height: SPRING.soft, opacity: { duration: 0.2 } }} className="overflow-hidden">
                      <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-400">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </GlassPanel>
      </Reveal>
    </section>
  )
}

/* ─── Closing CTA (peak-end) ─────────────────────────────────────────────── */
export function FinalCta() {
  return (
    <section className="cv-auto mx-auto max-w-6xl px-5 pb-24 sm:px-6">
      <Reveal variant="scale">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 px-6 py-20 text-center sm:px-12 sm:py-28">
          <AuroraBackdrop intensity={0.9} />
          <div aria-hidden className="grid-bg" />
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(8,7,11,.75))]" />
          <span aria-hidden className="edge" />
          <div className="relative">
            <TextReveal
              text="Ready to see your real score?"
              highlight={['real']}
              highlightClassName="text-fuchsia-300"
              className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl"
            />
            <p className="mx-auto mt-5 max-w-md text-[15px] text-slate-300">Free to use. Takes about a minute. Your first score is the hardest one to look at — and the most useful.</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/signup" size="lg" variant="accent" magnetic beam trailing={<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}>
                Create free account
              </Button>
              <Button href="/login" size="lg" variant="ghost">I already have one</Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

export function LandingFooter() {
  return (
    <footer className="cv-auto border-t border-white/[0.06] [contain-intrinsic-size:auto_160px]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row sm:px-6">
        <Logo />
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#privacy" className="hover:text-white">Privacy</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
        </nav>
        <p className="text-xs text-slate-600">© {new Date().getFullYear()} ResumeAI</p>
      </div>
      <p className="pb-8 text-center text-[11px] text-slate-700">Built with open-source components from React Bits, Kokonut UI, SmoothUI, unlumen UI and Bklit UI.</p>
    </footer>
  )
}
