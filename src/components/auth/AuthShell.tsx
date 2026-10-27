// src/components/auth/AuthShell.tsx
import Link from 'next/link'
import type { ReactNode } from 'react'
import BackgroundPaths from '@/components/vendor/kokonut/background-paths'
import ShinyText from '@/components/vendor/react-bits/ShinyText'
import { Check } from 'lucide-react'

// Split auth layout: interactive flowing-lines canvas (Kokonut UI "Background Paths")
// behind a brand panel on the left, the form on the right.
export function AuthShell({ title, subtitle, children, footer }: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0c0d] text-slate-100">
      <div className="absolute inset-0">
        <BackgroundPaths className="h-full w-full" count={40} speed={0.8}>{null}</BackgroundPaths>
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
        {/* Brand panel */}
        <aside className="hidden flex-col justify-between p-12 lg:flex">
          <Link href="/" className="flex w-fit items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_14px_2px_rgba(251,191,36,0.55)]" />
            <span className="font-display text-2xl font-semibold">ResumeAI</span>
          </Link>

          <div className="max-w-lg">
            <p className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs backdrop-blur">
              <ShinyText text="Recruiter-grade resume analysis" speed={3.5} color="#aab3ba" shineColor="#ffffff" />
            </p>
            <h2 className="font-display text-balance text-5xl font-semibold leading-[1.05]">
              Your next role starts with a <span className="text-amber-300">sharper</span> resume.
            </h2>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              {['Section-by-section scores with specific fixes', 'Tailor to any job in one click', 'Your API key never touches our database'].map(t => (
                <li key={t} className="flex items-center gap-2.5"><Check size={15} className="text-violet-400" />{t}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-600">Bring your own AI key · Free to use</p>
        </aside>

        {/* Form panel */}
        <main className="flex items-center justify-center p-6 lg:bg-[#0b0c0d]/80 lg:backdrop-blur-xl lg:border-l lg:border-white/8">
          <div className="blur-in w-full max-w-sm">
            <Link href="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_14px_2px_rgba(251,191,36,0.55)]" />
              <span className="font-display text-2xl font-semibold">ResumeAI</span>
            </Link>
            <div className="mb-7">
              <h1 className="font-display text-4xl font-semibold">{title}</h1>
              <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
            </div>
            {children}
            {footer && <div className="mt-6 text-sm text-slate-500">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  )
}
