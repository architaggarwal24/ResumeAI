// src/components/landing/LandingNav.tsx
'use client'
import Link from 'next/link'
import { Highlight, HighlightItem } from '@/components/vendor/unlumen/highlight'
import ShinyText from '@/components/vendor/react-bits/ShinyText'

// Floating pill nav. The hover background glides between links (unlumen UI "Highlight").
const LINKS = [
  { href: '#how', label: 'Features' },
  { href: '#providers', label: 'Providers' },
  { href: '#faq', label: 'FAQ' },
  { href: '/login', label: 'Sign in' },
]

export function LandingNav() {
  return (
    <header className="sticky top-4 z-50 mx-auto w-[min(94%,64rem)]">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b0c0d]/70 px-4 py-2.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_14px_2px_rgba(251,191,36,0.55)]" />
          <span className="font-display text-xl font-semibold">
            <ShinyText text="ResumeAI" speed={4} color="#e6ebee" shineColor="#72e0c8" />
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Highlight hover mode="parent" controlledItems className="rounded-lg bg-white/[0.08]" containerClassName="hidden items-center gap-0.5 sm:flex">
            {LINKS.map(l => (
              <HighlightItem key={l.href} value={l.href}>
                <Link href={l.href} className="block rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors hover:text-white">{l.label}</Link>
              </HighlightItem>
            ))}
          </Highlight>
          <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors hover:text-white sm:hidden">Sign in</Link>
          <Link href="/signup" className="btn-sheen rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition-transform hover:-translate-y-px">
            Get started
          </Link>
        </div>
      </div>
    </header>
  )
}
