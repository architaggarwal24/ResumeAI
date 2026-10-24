// src/app/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dayKey } from '@/lib/dates'
import { Aurora } from '@/components/ui/fx/Aurora'
import { BlurFade } from '@/components/ui/fx/BlurFade'
import { FlipWords } from '@/components/ui/fx/FlipWords'
import { Magnetic } from '@/components/ui/fx/Magnetic'
import { SpotlightCard } from '@/components/ui/fx/SpotlightCard'
import { AnimatedNumber } from '@/components/ui/fx/AnimatedNumber'
import { ScoreGauge } from '@/components/ui/viz/ScoreGauge'
import { RadarChart } from '@/components/ui/viz/RadarChart'
import { ActivityCalendar } from '@/components/ui/viz/ActivityCalendar'
import { ChevronRight, Check, X, Lock, Link2, Eye, ChevronDown } from 'lucide-react'

export const dynamic = 'force-dynamic'

const SAMPLE_SECTIONS = [
  { label: 'summary', value: 61 },
  { label: 'experience', value: 88 },
  { label: 'skills', value: 79 },
  { label: 'education', value: 84 },
  { label: 'projects', value: 72 },
]

const FAQ = [
  { q: 'What does it cost?', a: 'The app is free. You bring your own API key, so you pay your AI provider directly for what you use — typically a few cents per analysis.' },
  { q: 'Where does my API key live?', a: 'In your browser tab only (sessionStorage). It is never saved to our database. Each AI request is relayed through our server to your provider so it can work, and the key is used for that request alone.' },
  { q: 'Which AI providers work?', a: 'Anthropic, OpenAI, Google Gemini, OpenRouter and NVIDIA NIM. Pick the model you prefer in Settings.' },
  { q: 'Is my resume public?', a: 'No. It is only visible through share links you create yourself — each can have a password and an expiry, and you can revoke it any time.' },
  { q: 'Can I delete everything?', a: 'Yes. Delete individual resumes from the dashboard, or wipe all your data from Settings.' },
]

export default async function HomePage() {
  // Signed-in users go straight to their dashboard (unchanged behaviour).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  // Deterministic sample activity for the tracker preview (no randomness → no hydration drift).
  const sample: Record<string, number> = {}
  const now = new Date()
  for (let i = 0; i < 154; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const v = (i * 37 + 11) % 13
    if (v < 5) sample[dayKey(d)] = v < 2 ? 1 : v < 4 ? 2 : 4
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#0b0c0d] text-slate-100">
      <Aurora />

      {/* ─── Nav ─── */}
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_14px_2px_rgba(251,191,36,0.55)]" />
          <span className="font-display text-xl font-semibold">ResumeAI</span>
        </Link>
        <nav className="flex items-center gap-1">
          <a href="#how" className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:text-white sm:block">Features</a>
          <a href="#faq" className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:text-white sm:block">FAQ</a>
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:text-white">Sign in</Link>
          <Link href="/signup" className="btn-sheen ml-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition-transform hover:-translate-y-px">Get started</Link>
        </nav>
      </header>

      <main className="relative z-10">
        {/* ─── Hero: copy left, live analysis right ─── */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <div>
            <p className="blur-in mb-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-violet-300">
              <span className="h-px w-8 bg-violet-400/60" />Bring your own AI key
            </p>
            <h1 className="blur-in font-display text-balance text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl" style={{ '--d': '70ms' } as React.CSSProperties}>
              Find what’s <mark className="marker" style={{ '--d': '0.7s' } as React.CSSProperties}>holding your resume back</mark>.
            </h1>
            <p className="blur-in mt-7 max-w-xl text-pretty text-lg text-slate-400" style={{ '--d': '170ms' } as React.CSSProperties}>
              Recruiter-grade scoring, keyword matching and tailoring for{' '}
              <FlipWords words={['engineers', 'designers', 'marketers', 'analysts', 'students']} className="font-display text-xl italic text-slate-100" />
              . Then rehearse the interview.
            </p>
            <div className="blur-in mt-9 flex flex-wrap items-center gap-4" style={{ '--d': '270ms' } as React.CSSProperties}>
              <Magnetic>
                <Link href="/signup" className="border-beam btn-sheen inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-900/40 ring-1 ring-inset ring-white/15 transition-colors hover:bg-violet-500">
                  Score my resume <ChevronRight size={15} />
                </Link>
              </Magnetic>
              <Link href="/login" className="text-sm text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline">I already have an account</Link>
            </div>
            <ul className="blur-in mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500" style={{ '--d': '370ms' } as React.CSSProperties}>
              {['5 AI providers', 'PDF · DOCX · LaTeX export', 'Keys never stored'].map(t => (
                <li key={t} className="flex items-center gap-1.5"><Check size={12} className="text-violet-400" />{t}</li>
              ))}
            </ul>
          </div>

          {/* Sample analysis card */}
          <div className="blur-in relative" style={{ '--d': '300ms' } as React.CSSProperties}>
            <div className="glass float-y relative rounded-2xl p-6">
              <div className="mb-5 flex items-center justify-between text-xs">
                <span className="font-mono uppercase tracking-widest text-slate-500">Sample analysis</span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">Shortlist-ready</span>
              </div>
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                <ScoreGauge score={82} size={170} />
                <RadarChart data={SAMPLE_SECTIONS} size={190} />
              </div>
              <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3.5 py-3">
                <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-amber-300/80">Quickest win</p>
                <p className="font-display text-[15px] leading-snug text-slate-200">“Quantify the impact in your second role — hiring managers skim for numbers.”</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Stats strip (all factual) ─── */}
        <section className="border-y border-white/7 bg-white/[0.015]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-6 py-8 md:grid-cols-4">
            {[
              { n: 5, label: 'AI providers supported' },
              { n: 4, label: 'resume templates' },
              { n: 3, label: 'export formats' },
              { n: 0, label: 'API keys stored on our servers' },
            ].map(s => (
              <div key={s.label} className="text-center md:border-l md:border-white/7 first:md:border-l-0">
                <p className="font-display text-4xl font-semibold text-slate-100"><AnimatedNumber value={s.n} initialFrom={0} duration={900} /></p>
                <p className="mt-1 text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Bento: each tile previews its feature ─── */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
          <BlurFade className="mb-12 max-w-2xl">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-violet-300">The workflow</p>
            <h2 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">From first draft to <span className="marker">“we’d like to talk”</span></h2>
          </BlurFade>

          <div className="grid gap-4 md:grid-cols-6">
            {/* Score */}
            <BlurFade className="md:col-span-4">
              <SpotlightCard className="h-full p-6">
                <h3 className="mb-1 text-sm font-semibold">Scored section by section</h3>
                <p className="mb-5 max-w-md text-sm text-slate-400">See exactly where points are lost, with reasons and a one-line fix for each section.</p>
                <div className="space-y-3">
                  {SAMPLE_SECTIONS.map((s, i) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="w-20 text-xs capitalize text-slate-400">{s.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div className="rise h-full rounded-full" style={{ width: `${s.value}%`, background: s.value >= 70 ? '#34d399' : '#fbbf24', '--d': `${i * 90}ms` } as React.CSSProperties} />
                      </div>
                      <span className="w-7 text-right font-mono text-xs text-slate-300">{s.value}</span>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </BlurFade>

            {/* Tailor */}
            <BlurFade className="md:col-span-2" delay={80}>
              <SpotlightCard className="h-full p-6">
                <h3 className="mb-1 text-sm font-semibold">Tailored per job</h3>
                <p className="mb-4 text-sm text-slate-400">Your original is snapshotted first.</p>
                <div className="space-y-2 text-xs">
                  <p className="rounded-md bg-red-400/[0.07] px-2.5 py-2 text-slate-500 line-through decoration-red-400/50">Worked on backend services</p>
                  <p className="rounded-md bg-emerald-400/[0.08] px-2.5 py-2 text-slate-200">Cut API latency 38% across 12 Go services</p>
                </div>
              </SpotlightCard>
            </BlurFade>

            {/* Keywords */}
            <BlurFade className="md:col-span-2" delay={60}>
              <SpotlightCard className="h-full p-6">
                <h3 className="mb-1 text-sm font-semibold">ATS keyword match</h3>
                <p className="mb-4 text-sm text-slate-400">Paste a job post, see what’s missing.</p>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {['Kubernetes', 'CI/CD', 'Go', 'gRPC'].map(k => <span key={k} className="flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-emerald-300"><Check size={9} />{k}</span>)}
                  {['Terraform', 'Kafka'].map(k => <span key={k} className="flex items-center gap-1 rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 text-red-300"><X size={9} />{k}</span>)}
                </div>
              </SpotlightCard>
            </BlurFade>

            {/* Interview */}
            <BlurFade className="md:col-span-2" delay={120}>
              <SpotlightCard className="h-full p-6">
                <h3 className="mb-1 text-sm font-semibold">Mock interviews</h3>
                <p className="mb-4 text-sm text-slate-400">An interviewer that has read your resume.</p>
                <div className="space-y-2 text-xs">
                  <p className="max-w-[88%] rounded-xl rounded-bl-sm bg-white/[0.06] px-3 py-2 text-slate-300">Walk me through the latency project.</p>
                  <p className="ml-auto max-w-[80%] rounded-xl rounded-br-sm bg-violet-600/30 px-3 py-2 text-violet-100">We profiled hot paths, then…</p>
                </div>
              </SpotlightCard>
            </BlurFade>

            {/* Share */}
            <BlurFade className="md:col-span-2" delay={180}>
              <SpotlightCard className="h-full p-6">
                <h3 className="mb-1 text-sm font-semibold">Private share links</h3>
                <p className="mb-4 text-sm text-slate-400">Password, expiry, revoke any time.</p>
                <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/30 px-3 py-2 text-xs text-slate-400">
                  <Link2 size={12} className="shrink-0 text-violet-300" /><span className="truncate font-mono">yourapp.com/s/k3Fq…</span>
                  <Lock size={11} className="ml-auto shrink-0 text-amber-300" />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><Eye size={11} />14 views · expires in 6 days</p>
              </SpotlightCard>
            </BlurFade>

            {/* Tracker */}
            <BlurFade className="md:col-span-6" delay={100}>
              <SpotlightCard className="p-6">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Track every application</h3>
                    <p className="max-w-md text-sm text-slate-400">A job tracker, score history and an activity calendar — so you can see the momentum, not just the pile.</p>
                  </div>
                  <div className="flex gap-1.5 text-[11px]">
                    {[['Saved', 'text-slate-300'], ['Applied', 'text-sky-300'], ['Interviewing', 'text-amber-300'], ['Offer', 'text-emerald-300']].map(([l, c]) => (
                      <span key={l} className={`rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 ${c}`}>{l}</span>
                    ))}
                  </div>
                </div>
                <ActivityCalendar counts={sample} weeks={26} noun="actions" />
              </SpotlightCard>
            </BlurFade>
          </div>
        </section>

        {/* ─── Privacy, in plain words ─── */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <BlurFade>
            <div className="ruled rounded-2xl border border-white/8 bg-[#111214] p-8 sm:p-12">
              <div className="grid items-start gap-10 md:grid-cols-[1fr_1.2fr]">
                <div>
                  <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-violet-300"><Lock size={13} />Privacy</p>
                  <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Your key. Your data. <span className="marker">Your call.</span></h2>
                </div>
                <ul className="space-y-3.5 text-sm text-slate-300">
                  {[
                    'API keys stay in your browser tab and are never written to our database.',
                    'Each AI request is relayed to your provider, then forgotten.',
                    'Share links are optional, password-protectable, expiring and revocable.',
                    'Delete a resume — or everything — whenever you like.',
                  ].map(t => <li key={t} className="flex gap-3"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />{t}</li>)}
                </ul>
              </div>
            </div>
          </BlurFade>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 pb-24">
          <BlurFade className="mb-8">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Questions, answered</h2>
          </BlurFade>
          <div className="divide-y divide-white/8 rounded-xl border border-white/8 bg-[#111214]">
            {FAQ.map(f => (
              <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-slate-200">
                  {f.q}
                  <ChevronDown size={16} className="shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="rise mt-3 pr-8 text-sm leading-relaxed text-slate-400">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="mx-auto max-w-3xl px-6 pb-28 text-center">
          <BlurFade>
            <h2 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">Ready to see your <span className="marker">real</span> score?</h2>
            <div className="mt-9">
              <Magnetic>
                <Link href="/signup" className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-slate-100 px-7 py-3.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-white">
                  Create free account <ChevronRight size={15} />
                </Link>
              </Magnetic>
            </div>
          </BlurFade>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/7 py-8 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} ResumeAI
      </footer>
    </div>
  )
}
