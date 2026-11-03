// src/components/ui/glass/Atoms.tsx
// Small presentational pieces shared across screens.
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'brand' | 'amber' | 'success' | 'danger' | 'info'

const TONE: Record<Tone, string> = {
  neutral: 'border-white/10 bg-white/[0.05] text-slate-300',
  brand: 'border-violet-300/25 bg-violet-400/10 text-violet-200',
  amber: 'border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-200',
  success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  danger: 'border-red-400/25 bg-red-400/10 text-red-300',
  info: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
}

export function Badge({ tone = 'neutral', dot = false, className, children }: {
  tone?: Tone; dot?: boolean; className?: string; children: ReactNode
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium', TONE[tone], className)}>
      {dot && (
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 animate-[ping-soft_1.8s_ease-out_infinite] rounded-full bg-current" />
          <span className="relative size-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] px-1.5 font-mono text-[10px] text-slate-400 shadow-[inset_0_-1px_0_rgba(255,255,255,.08)]', className)}>
      {children}
    </kbd>
  )
}

/** Small mono uppercase label above a heading. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-violet-300', className)}>
      <span aria-hidden className="h-px w-6 bg-gradient-to-r from-transparent to-violet-300/80" />
      {children}
    </p>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />
}

/** Seamless CSS marquee; content is duplicated so the loop never gaps. */
export function Marquee({ children, duration = 32, reverse = false, className, pauseOnHover = true }: {
  children: ReactNode; duration?: number; reverse?: boolean; className?: string; pauseOnHover?: boolean
}) {
  return (
    <div className={cn('group fade-x flex overflow-hidden', className)}>
      <div
        className={cn('flex w-max shrink-0 animate-marquee motion-reduce:animate-none', pauseOnHover && 'group-hover:[animation-play-state:paused]')}
        style={{ '--marquee-duration': `${duration}s`, animationDirection: reverse ? 'reverse' : 'normal' } as React.CSSProperties}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div aria-hidden className="flex shrink-0 items-center">{children}</div>
      </div>
    </div>
  )
}
