// src/app/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dayKey } from '@/lib/dates'
import { LandingNav } from '@/components/landing/LandingNav'
import { HeroDemo } from '@/components/landing/HeroDemo'
import { BlurFade } from '@/components/ui/fx/BlurFade'
import SoftAurora from '@/components/vendor/react-bits/SoftAurora'
import BlurText from '@/components/vendor/react-bits/BlurText'
import RotatingText from '@/components/vendor/react-bits/RotatingText'
import ShinyText from '@/components/vendor/react-bits/ShinyText'
import CountUp from '@/components/vendor/react-bits/CountUp'
import ScrollVelocity from '@/components/vendor/react-bits/ScrollVelocity'
import StarBorder from '@/components/vendor/react-bits/StarBorder'
import Magnet from '@/components/vendor/react-bits/Magnet'
import ClickSpark from '@/components/vendor/react-bits/ClickSpark'
import { SpotCard } from '@/components/ui/SpotCard'
import { MarkerText, Mark } from '@/components/vendor/kokonut/marker-text'
import ScrollRevealParagraph from '@/components/vendor/smoothui/scroll-reveal-paragraph'
import FaqsGrid from '@/components/vendor/smoothui/faq-1'
import { ContributionGraph, type ContributionData } from '@/components/vendor/smoothui/contribution-graph'
import { ChevronRight, Check, X, Lock, Link2, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

const SECTIONS = [
  { label: 'Experience', value: 88 },
  { label: 'Education', value: 84 },
  { label: 'Skills', value: 79 },
  { label: 'Projects', value: 72 },
  { label: 'Summary', value: 61 },
]

const FAQ_CATEGORIES = [
  {
    id: 'general', name: 'General',
    faqs: [
      { icon: 'DollarSign', question: 'What does it cost?', answer: 'The app is free. You bring your own API key, so you pay your AI provider directly for what you use — typically a few cents per analysis.' },
      { icon: 'Globe', question: 'Which AI providers work?', answer: 'Anthropic, OpenAI, Google Gemini, OpenRouter and NVIDIA NIM. Pick the model you prefer in Settings.' },
      { icon: 'Download', question: 'Can I export my resume?', answer: 'Yes — PDF, DOCX and LaTeX, across four templates.' },
    ],
  },
  {
    id: 'privacy', name: 'Privacy',
    faqs: [
      { icon: 'Lock', question: 'Where does my API key live?', answer: 'In your browser tab only (sessionStorage). It is never saved to our database. Each AI request is relayed through our server to your provider so it can work, and the key is used for that request alone.' },
      { icon: 'Users', question: 'Is my resume public?', answer: 'No. It is only visible through share links you create yourself — each can have a password and an expiry, and you can revoke it any time.' },
      { icon: 'Undo2', question: 'Can I delete everything?', answer: 'Yes. Delete individual resumes from the dashboard, or wipe all your data from Settings.' },
    ],
  },
]

export default async function HomePage() {
  // Signed-in users go straight to their dashboard (unchanged behaviour).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  // Deterministic sample activity for the tracker preview (no randomness → no hydration drift).
  const now = new Date()
  const activity: ContributionData[] = []
  for (let i = 0; i < 230; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const v = (i * 37 + 11) % 13
    if (v < 5) {
      const count = v < 2 ? 1 : v < 4 ? 3 : 6
      activity.push({ date: dayKey(d), count, level: v < 2 ? 1 : v < 4 ? 2 : 4 })
    }
  }

  return (
    <ClickSpark sparkColor="#fbbf24" sparkCount={9} sparkRadius={22} duration={550}>
      <div className="relative min-h-screen overflow-x-clip bg-[#0b0c0d] text-slate-100">
        {/* ─── Hero ─── */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <SoftAurora color1="#19a88e" color2="#0b6e8a" spectrum={0} brightness={0.7} opacity={0.9} scale={1.2} bandHeight={0.6} bandSpread={1.5} speed={0.5} enableMouseInteraction mouseInfluence={0.3} className="h-full w-full" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(11,12,13,0),rgba(11,12,13,0.35)_55%,#0b0c0d)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_18%_45%,rgba(11,12,13,0.8),transparent)]" />
          </div>

          <div className="pt-4"><LandingNav /></div>

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-28 pt-16 lg:grid-cols-[1fr_1.1fr] lg:pt-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <ShinyText text="Bring your own AI key — nothing stored" speed={3.5} color="#aab3ba" shineColor="#ffffff" />
              </div>

              <MarkerText>
                <h1 className="font-display text-balance text-5xl font-semibold leading-[1.04] sm:text-6xl lg:text-7xl">
                  Find what’s <Mark type="highlight" color="rgba(251,191,36,0.4)">holding your resume back</Mark>.
                </h1>
              </MarkerText>

              <div className="mt-7 max-w-xl text-lg text-slate-300">
                <BlurText text="Recruiter-grade scoring, keyword matching and tailoring." animateBy="words" delay={90} className="text-lg text-slate-300" />
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-lg text-slate-400">
                  Built for
                  <RotatingText
                    texts={['engineers', 'designers', 'marketers', 'analysts', 'students']}
                    rotationInterval={2600} animatePresenceMode="wait" staggerDuration={0.015} transition={{ type: 'spring', damping: 28, stiffness: 420 }}
                    mainClassName="inline-flex min-w-[8.5rem] justify-center overflow-hidden rounded-lg bg-violet-500/20 px-2.5 py-0.5 font-display text-xl italic text-violet-100"
                  />
                </p>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-5">
                <Magnet magnetStrength={4}>
                  <StarBorder as="a" href="/signup" color="#fbbf24" trailColor="#3cc9ae" backgroundColor="#0f9a82" textColor="#ffffff" className="text-sm font-semibold">
                    <span className="flex items-center gap-2">Score my resume <ChevronRight size={15} /></span>
                  </StarBorder>
                </Magnet>
                <Link href="/login" className="text-sm text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline">I already have an account</Link>
              </div>

              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                {['5 AI providers', 'PDF · DOCX · LaTeX export', 'Keys never stored'].map(t => (
                  <li key={t} className="flex items-center gap-1.5"><Check size={12} className="text-violet-400" />{t}</li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(closest-side,rgba(60,201,174,0.18),transparent)]" />
              <HeroDemo />
            </div>
          </div>
        </section>

        {/* ─── Providers marquee ─── */}
        <section id="providers" className="scroll-mt-24 border-y border-white/7 bg-white/[0.015] py-6">
          <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Works with the model you already pay for</p>
          <ScrollVelocity
            texts={[
              ['Anthropic', 'OpenAI', 'Google Gemini', 'OpenRouter', 'NVIDIA NIM'].map((n, i) => (
                <span key={n}>{i > 0 && <span className="mx-6 text-amber-300/70">✦</span>}{n}</span>
              )),
            ]}
            velocity={45} fontSize="2rem" color="#6b747c" className="font-display"
            separator={<span className="mx-6 text-amber-300/70">✦</span>} fadeEdges
          />
        </section>

        {/* ─── Stats ─── */}
        <section className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-6 py-14 md:grid-cols-4">
          {[
            { n: 5, label: 'AI providers supported' },
            { n: 4, label: 'resume templates' },
            { n: 3, label: 'export formats' },
            { n: 0, label: 'API keys stored on our servers' },
          ].map(s => (
            <div key={s.label} className="text-center md:border-l md:border-white/7 first:md:border-l-0">
              <p className="font-display text-5xl font-semibold text-slate-100"><CountUp to={s.n} duration={1.6} /></p>
              <p className="mt-1 text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </section>

        {/* ─── Statement ─── */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <ScrollRevealParagraph paragraph="Most resumes are rejected in seconds — by software first, then by a person skimming for numbers. See what they see, fix the weak spots, and walk into the interview ready." />
        </section>

        {/* ─── Bento ─── */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24">
          <BlurFade className="mb-12 max-w-2xl">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-violet-300">The workflow</p>
            <h2 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">From first draft to <span className="text-amber-300">“we’d like to talk”</span></h2>
          </BlurFade>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-6 [&>*]:min-w-0">
            <BlurFade className="md:col-span-4">
              <SpotCard className="h-full p-6!">
                <h3 className="mb-1 text-sm font-semibold">Scored section by section</h3>
                <p className="mb-5 max-w-md text-sm text-slate-400">See exactly where points are lost, with reasons and a one-line fix for each section.</p>
                <div className="space-y-3">
                  {SECTIONS.map((s, i) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="w-20 text-xs text-slate-400">{s.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div className="rise h-full rounded-full" style={{ width: `${s.value}%`, background: s.value >= 70 ? '#34d399' : '#fbbf24', '--d': `${i * 90}ms` } as React.CSSProperties} />
                      </div>
                      <span className="w-7 text-right font-mono text-xs text-slate-300">{s.value}</span>
                    </div>
                  ))}
                </div>
              </SpotCard>
            </BlurFade>

            <BlurFade className="md:col-span-2" delay={80}>
              <SpotCard className="h-full p-6!">
                <h3 className="mb-1 text-sm font-semibold">Tailored per job</h3>
                <p className="mb-4 text-sm text-slate-400">Your original is snapshotted first.</p>
                <div className="space-y-2 text-xs">
                  <p className="rounded-md bg-red-400/[0.07] px-2.5 py-2 text-slate-500 line-through decoration-red-400/50">Worked on backend services</p>
                  <p className="rounded-md bg-emerald-400/[0.08] px-2.5 py-2 text-slate-200">Cut API latency 38% across 12 Go services</p>
                </div>
              </SpotCard>
            </BlurFade>

            <BlurFade className="md:col-span-2" delay={60}>
              <SpotCard className="h-full p-6!">
                <h3 className="mb-1 text-sm font-semibold">ATS keyword match</h3>
                <p className="mb-4 text-sm text-slate-400">Paste a job post, see what’s missing.</p>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {['Kubernetes', 'CI/CD', 'Go', 'gRPC'].map(k => <span key={k} className="flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-emerald-300"><Check size={9} />{k}</span>)}
                  {['Terraform', 'Kafka'].map(k => <span key={k} className="flex items-center gap-1 rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 text-red-300"><X size={9} />{k}</span>)}
                </div>
              </SpotCard>
            </BlurFade>

            <BlurFade className="md:col-span-2" delay={120}>
              <SpotCard className="h-full p-6!">
                <h3 className="mb-1 text-sm font-semibold">Mock interviews</h3>
                <p className="mb-4 text-sm text-slate-400">An interviewer that has read your resume.</p>
                <div className="space-y-2 text-xs">
                  <p className="max-w-[88%] rounded-xl rounded-bl-sm bg-white/[0.06] px-3 py-2 text-slate-300">Walk me through the latency project.</p>
                  <p className="ml-auto max-w-[80%] rounded-xl rounded-br-sm bg-violet-600/30 px-3 py-2 text-violet-100">We profiled hot paths, then…</p>
                </div>
              </SpotCard>
            </BlurFade>

            <BlurFade className="md:col-span-2" delay={180}>
              <SpotCard className="h-full p-6!">
                <h3 className="mb-1 text-sm font-semibold">Private share links</h3>
                <p className="mb-4 text-sm text-slate-400">Password, expiry, revoke any time.</p>
                <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/30 px-3 py-2 text-xs text-slate-400">
                  <Link2 size={12} className="shrink-0 text-violet-300" /><span className="truncate font-mono">yourapp.com/s/k3Fq…</span>
                  <Lock size={11} className="ml-auto shrink-0 text-amber-300" />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><Eye size={11} />14 views · expires in 6 days</p>
              </SpotCard>
            </BlurFade>

            <BlurFade className="md:col-span-6" delay={100}>
              <SpotCard className="p-6!">
                <div className="mb-5 max-w-lg">
                  <h3 className="mb-1 text-sm font-semibold">Track every application</h3>
                  <p className="text-sm text-slate-400">A job tracker, score history and an activity graph — so you can see the momentum, not just the pile.</p>
                </div>
                <div className="overflow-x-auto"><div className="min-w-[640px]"><ContributionGraph data={activity} /></div></div>
              </SpotCard>
            </BlurFade>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-24 [&>section]:bg-transparent [&>section]:py-0">
          <FaqsGrid title="Questions, answered" description="Straight answers about cost, keys and your data." categories={FAQ_CATEGORIES} />
        </section>

        {/* ─── CTA ─── */}
        <section className="mx-auto max-w-3xl px-6 pb-28 text-center">
          <BlurFade>
            <h2 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">Ready to see your <span className="text-amber-300">real</span> score?</h2>
            <div className="mt-9 flex justify-center">
              <Magnet magnetStrength={4}>
                <StarBorder as="a" href="/signup" color="#fbbf24" trailColor="#3cc9ae" backgroundColor="#e6ebee" textColor="#0b0c0d" className="text-sm font-semibold">
                  <span className="flex items-center gap-2">Create free account <ChevronRight size={15} /></span>
                </StarBorder>
              </Magnet>
            </div>
          </BlurFade>
        </section>

        <footer className="border-t border-white/7 py-8 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} ResumeAI · Built with open-source components from React Bits, Kokonut UI, SmoothUI, unlumen UI and Bklit UI
        </footer>
      </div>
    </ClickSpark>
  )
}
