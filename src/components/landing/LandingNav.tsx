'use client'
// src/components/landing/LandingNav.tsx
// Floating glass pill. Tightens and frosts harder once you scroll; the hover
// background glides between links (shared layoutId). Mobile: glass sheet menu.
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/glass/Button'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#faq', label: 'FAQ' },
]

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('group flex items-center gap-2.5', className)} aria-label="ResumeAI home">
      <span className="relative grid size-8 place-items-center rounded-[10px] bg-[linear-gradient(145deg,#c4b5fd,#7c3aed_55%,#3b0f7a)] shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_6px_20px_-6px_rgba(139,92,246,.8)] transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M6 4h8l4 4v12H6z" /><path d="M9 13h6M9 17h4" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_2px_rgba(232,121,249,.7)]" />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-white">Resume<span className="text-violet-300">AI</span></span>
    </Link>
  )
}

export function LandingNav() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useMotionValueEvent(scrollY, 'change', v => setScrolled(v > 24))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3 sm:top-4">
      <motion.nav
        aria-label="Main"
        animate={{ width: scrolled ? 'min(100%, 52rem)' : 'min(100%, 72rem)' }}
        transition={SPRING.soft}
        className={cn(
          'pointer-events-auto relative flex items-center justify-between rounded-2xl px-3 py-2 transition-[background,box-shadow,border-color] duration-300',
          scrolled ? 'glass-strong' : 'border border-transparent bg-transparent',
        )}
      >
        {scrolled && <span aria-hidden className="edge" />}
        <Logo />

        <ul className="hidden items-center md:flex" onMouseLeave={() => setHovered(null)}>
          {LINKS.map(l => (
            <li key={l.href} className="relative">
              <a
                href={l.href}
                onMouseEnter={() => setHovered(l.href)}
                onFocus={() => setHovered(l.href)}
                className="relative z-10 block rounded-lg px-3.5 py-2 text-sm text-slate-300 transition-colors hover:text-white"
              >
                {l.label}
              </a>
              {hovered === l.href && (
                <motion.span layoutId="nav-hover" transition={SPRING.snappy} className="absolute inset-0 rounded-lg bg-white/[0.08]" />
              )}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1.5">
          <Link href="/login" className="hidden rounded-lg px-3.5 py-2 text-sm text-slate-300 transition-colors hover:text-white sm:block">Sign in</Link>
          <Button href="/signup" size="sm" magnetic trailing={<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />}>
            Get started
          </Button>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
            className="press grid size-10 place-items-center rounded-xl text-slate-200 hover:bg-white/[0.07] md:hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={open ? 'x' : 'm'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
              exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.15 } }}
              transition={SPRING.soft}
              className="glass-strong absolute inset-x-0 top-[calc(100%+8px)] rounded-2xl p-2 md:hidden"
            >
              <span aria-hidden className="edge" />
              {[...LINKS, { href: '/login', label: 'Sign in' }].map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: 0.03 * i } }}
                  className="flex min-h-12 items-center justify-between rounded-xl px-4 text-[15px] text-slate-200 active:bg-white/[0.06]"
                >
                  {l.label}
                  <ArrowRight className="size-4 text-slate-500" />
                </motion.a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </header>
  )
}
