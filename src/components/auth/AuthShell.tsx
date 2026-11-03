// src/components/auth/AuthShell.tsx
// Split auth layout on the aurora. Left: brand promise + a floating glass
// "result" preview (shows the payoff before asking for anything — Peak-End).
// Right: the form on a strong glass card. Mobile: just the card.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Check, Sparkles, TrendingUp } from 'lucide-react'
import { AuroraBackdrop, CursorGlow } from '@/components/ui/glass/Ambient'
import { Logo } from '@/components/landing/LandingNav'

export function AuthShell({ title, subtitle, children, footer }: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-ink text-slate-100">
      <AuroraBackdrop webgl />
      <div aria-hidden className="grid-bg" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(8,7,11,.55),transparent_70%)]" />
      <CursorGlow />

      <div className="relative z-10 mx-auto grid min-h-[100svh] max-w-6xl items-center gap-10 px-5 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        {/* Brand panel */}
        <aside className="hidden flex-col justify-between self-stretch py-4 lg:flex">
          <Logo />

          <div className="max-w-lg">
            <p className="blur-in mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">
              <Sparkles className="size-3.5" />Recruiter-grade resume analysis
            </p>
            <h2 className="blur-in text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.035em]" style={{ '--d': '80ms' } as React.CSSProperties}>
              <span className="text-lit">Your next role starts with a </span><span className="gradient-text">sharper</span><span className="text-lit"> resume.</span>
            </h2>
            <ul className="mt-8 space-y-3.5 text-[15px] text-slate-300">
              {['Section-by-section scores with specific fixes', 'Tailor to any job in one click', 'Your API key never touches our database'].map((t, i) => (
                <li key={t} className="blur-in flex items-center gap-3" style={{ '--d': `${200 + i * 90}ms` } as React.CSSProperties}>
                  <span className="grid size-5 place-items-center rounded-full bg-violet-400/15 text-violet-300"><Check className="size-3" strokeWidth={3} /></span>{t}
                </li>
              ))}
            </ul>

            {/* Floating preview */}
            <div className="blur-in float-y mt-12 w-[22rem]" style={{ '--d': '500ms' } as React.CSSProperties}>
              <div className="glass-strong no-blur relative rounded-2xl p-4">
                <span aria-hidden className="edge" />
                <div className="flex items-center gap-4">
                  <div className="relative grid size-16 place-items-center rounded-full bg-[conic-gradient(#a78bfa_0_86%,rgba(255,255,255,.08)_86%_100%)]">
                    <div className="grid size-[52px] place-items-center rounded-full bg-[#110e17] font-mono text-lg font-semibold text-white">86</div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Product Designer · v3</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-300"><TrendingUp className="size-3.5" />+18 pts since first upload</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Bring your own AI key · Free to use</p>
        </aside>

        {/* Form panel */}
        <main className="flex justify-center">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden"><Logo /></div>
            <div className="blur-in glass-strong relative rounded-[28px] p-6 sm:p-8" style={{ '--d': '120ms' } as React.CSSProperties}>
              <span aria-hidden className="edge" />
              <div className="mb-7">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.1rem]">{title}</h1>
                <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
              </div>
              {children}
            </div>
            {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
            <p className="mt-6 text-center text-xs text-slate-600">
              <Link href="/" className="hover:text-slate-300">← Back to home</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
