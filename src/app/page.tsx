// src/app/page.tsx
import { redirect } from 'next/navigation'
import { ArrowDown, ArrowRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LandingNav } from '@/components/landing/LandingNav'
import { HeroScene } from '@/components/landing/HeroScene'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { FeatureBento } from '@/components/landing/FeatureBento'
import { ProviderMarquee, StatsBand, PrivacyFlow, Faq, FinalCta, LandingFooter } from '@/components/landing/LandingSections'
import { AuroraBackdrop, CursorGlow, ScrollProgress } from '@/components/ui/glass/Ambient'
import { Button } from '@/components/ui/glass/Button'
import { Badge } from '@/components/ui/glass/Atoms'
import ClickSpark from '@/components/vendor/react-bits/ClickSpark'

export const dynamic = 'force-dynamic'

// Headline words are rendered on the server and blur in with pure CSS, so the
// LCP element is visible even before hydration.
const HEADLINE: { w: string; hl?: boolean }[] = [
  { w: 'Find' }, { w: 'what’s' },
  { w: 'holding', hl: true }, { w: 'your', hl: true }, { w: 'resume', hl: true }, { w: 'back.', hl: true },
]

export default async function HomePage() {
  // Signed-in users go straight to their dashboard (unchanged behaviour).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <ClickSpark sparkColor={['#e879f9', '#a78bfa']} sparkCount={10} sparkRadius={26} duration={600}>
      <div className="relative min-h-screen overflow-x-clip bg-ink text-slate-100">
        <ScrollProgress />
        <CursorGlow />
        <LandingNav />

        {/* ─── Hero ─── */}
        <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden pb-16 pt-28 sm:pt-32">
          <div className="absolute inset-0 -z-10">
            <AuroraBackdrop webgl />
            <div aria-hidden className="grid-bg" />
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_55%_65%_at_22%_50%,rgba(8,7,11,.78),transparent)]" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-ink" />
          </div>

          <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
            <div>
              <div className="blur-in" style={{ '--d': '0ms' } as React.CSSProperties}>
                <Badge tone="brand" dot className="mb-7 px-3 py-1 text-xs backdrop-blur">Bring your own AI key — nothing stored</Badge>
              </div>

              <h1 className="text-balance text-[2.9rem] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-[5.2rem]">
                {HEADLINE.map((x, i) => (
                  <span key={i} className="blur-in inline-block" style={{ '--d': `${120 + i * 70}ms` } as React.CSSProperties}>
                    <span className={x.hl ? 'gradient-text' : 'text-lit'}>{x.w}</span>{i < HEADLINE.length - 1 && ' '}
                  </span>
                ))}
              </h1>
              <svg aria-hidden viewBox="0 0 300 14" className="-mt-1 ml-1 h-3 w-[min(68%,22rem)] text-fuchsia-300/80" preserveAspectRatio="none">
                <path d="M2 9 C 60 3, 120 3, 180 7 S 270 12, 298 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" pathLength={1} className="draw" style={{ animationDelay: '.75s' }} />
              </svg>

              <p className="blur-in mt-7 max-w-xl text-pretty text-lg leading-relaxed text-slate-300" style={{ '--d': '520ms' } as React.CSSProperties}>
                Recruiter-grade scoring, keyword matching and tailoring — section by section, with the one fix that moves the needle most.
              </p>

              <div className="blur-in mt-10 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ '--d': '640ms' } as React.CSSProperties}>
                <Button href="/signup" size="lg" magnetic beam trailing={<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}>
                  Score my resume — free
                </Button>
                <Button href="#how" size="lg" variant="secondary" trailing={<ArrowDown className="size-4 transition-transform group-hover:translate-y-0.5" />}>
                  See how it works
                </Button>
              </div>

              <ul className="blur-in mt-9 flex flex-wrap gap-x-6 gap-y-2.5 text-[13px] text-slate-400" style={{ '--d': '760ms' } as React.CSSProperties}>
                {['5 AI providers', 'PDF · DOCX · LaTeX', 'Keys never stored'].map(t => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="grid size-4 place-items-center rounded-full bg-violet-400/15 text-violet-300"><Check className="size-2.5" strokeWidth={3} /></span>{t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="blur-in" style={{ '--d': '300ms' } as React.CSSProperties}>
              <HeroScene />
            </div>
          </div>

          <a href="#how" aria-label="Scroll to how it works" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-slate-500 transition-colors hover:text-slate-300 md:flex">
            <span className="flex h-9 w-5.5 justify-center rounded-full border border-white/15 pt-1.5">
              <span className="h-2 w-0.5 animate-[float-y_1.8s_ease-in-out_infinite] rounded-full bg-current" />
            </span>
          </a>
        </section>

        <ProviderMarquee />
        <StatsBand />
        <HowItWorks />
        <FeatureBento />
        <PrivacyFlow />
        <Faq />
        <FinalCta />
        <LandingFooter />
      </div>
    </ClickSpark>
  )
}
