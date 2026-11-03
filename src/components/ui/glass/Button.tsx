'use client'
// src/components/ui/glass/Button.tsx
// One button for the whole app. Variants map to intent, not colour:
//   primary — the one thing to do on a view (Von Restorff); glow + sheen
//   accent  — amber highlight for a single celebratory/peak action
//   secondary — glass; ghost — text-only; danger — destructive
// Extras: magnetic pull (full tier), press scale, click ripple, loading state.
import Link from 'next/link'
import { forwardRef, useRef, useState, type ComponentPropsWithoutRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring, AnimatePresence } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMotionTier } from './MotionTier'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'press group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium ' +
  'outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-ink'

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'btn-sheen text-white bg-[linear-gradient(180deg,#a78bfa_0%,#7c3aed_55%,#6d28d9_100%)] ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_0_0_1px_rgba(167,139,250,.55),0_10px_30px_-8px_rgba(124,58,237,.75)] ' +
    'hover:shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_0_0_1px_rgba(196,181,253,.8),0_14px_44px_-8px_rgba(139,92,246,.95)]',
  accent:
    'btn-sheen text-ink bg-[linear-gradient(180deg,#f5d0fe_0%,#e879f9_60%,#c026d3_100%)] ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,.6),0_0_0_1px_rgba(232,121,249,.55),0_10px_30px_-8px_rgba(232,121,249,.6)] ' +
    'hover:shadow-[inset_0_1px_0_rgba(255,255,255,.7),0_0_0_1px_rgba(245,208,254,.9),0_14px_44px_-8px_rgba(232,121,249,.85)]',
  secondary:
    'glass-subtle text-slate-100 hover:border-white/20 hover:bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,.06)]',
  ghost: 'text-slate-300 hover:bg-white/[0.06] hover:text-white',
  danger:
    'text-red-100 bg-red-500/15 border border-red-400/30 hover:bg-red-500/25 hover:border-red-400/50',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-[15px] rounded-2xl',
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  magnetic?: boolean
  /** Rotating light around the border. */
  beam?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  className?: string
  children?: ReactNode
}

type ButtonAsButton = CommonProps & Omit<ComponentPropsWithoutRef<'button'>, keyof CommonProps> & { href?: undefined }
type ButtonAsLink = CommonProps & Omit<ComponentPropsWithoutRef<'a'>, keyof CommonProps> & { href: string }
export type ButtonProps = ButtonAsButton | ButtonAsLink

interface Ripple { id: number; x: number; y: number }

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button(props, ref) {
  const {
    variant = 'primary', size = 'md', loading = false, magnetic = false, beam = false,
    leading, trailing, className, children, ...rest
  } = props
  const tier = useMotionTier()
  const wrap = useRef<HTMLSpanElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 180, damping: 16, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 180, damping: 16, mass: 0.4 })
  const [ripples, setRipples] = useState<Ripple[]>([])
  const useMagnet = magnetic && tier === 'full'

  function onMove(e: PointerEvent<HTMLSpanElement>) {
    if (!useMagnet || e.pointerType === 'touch' || !wrap.current) return
    const r = wrap.current.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * 0.3)
    y.set((e.clientY - (r.top + r.height / 2)) * 0.4)
  }
  function onLeave() { x.set(0); y.set(0) }

  function addRipple(e: MouseEvent<HTMLElement>) {
    if (tier === 'off') return
    const r = e.currentTarget.getBoundingClientRect()
    const id = Date.now() + Math.random()
    setRipples(rs => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }])
    window.setTimeout(() => setRipples(rs => rs.filter(rr => rr.id !== id)), 650)
  }

  const content = (
    <>
      {beam && <span aria-hidden className="border-beam pointer-events-none absolute inset-0 rounded-[inherit]" />}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <AnimatePresence>
          {ripples.map(r => (
            <motion.span
              key={r.id}
              initial={{ opacity: 0.45, scale: 0 }}
              animate={{ opacity: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50"
              style={{ left: r.x, top: r.y }}
            />
          ))}
        </AnimatePresence>
      </span>
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : leading}
      <span className="relative">{children}</span>
      {!loading && trailing}
    </>
  )

  const cls = cn(BASE, VARIANT[variant], SIZE[size], className)

  const inner = 'href' in rest && rest.href !== undefined
    ? (() => {
        const { href, onClick, ...a } = rest as ButtonAsLink
        const isInternal = href.startsWith('/') || href.startsWith('#')
        const handle = (e: MouseEvent<HTMLAnchorElement>) => { addRipple(e); onClick?.(e) }
        return isInternal
          ? <Link ref={ref as React.Ref<HTMLAnchorElement>} href={href} onClick={handle} className={cls} {...a}>{content}</Link>
          : <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} onClick={handle} className={cls} {...a}>{content}</a>
      })()
    : (() => {
        const { onClick, disabled, type, ...b } = rest as ButtonAsButton
        return (
          <button
            ref={ref as React.Ref<HTMLButtonElement>}
            type={type ?? 'button'}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            onClick={e => { addRipple(e); onClick?.(e) }}
            className={cls}
            {...b}
          >
            {content}
          </button>
        )
      })()

  if (!magnetic) return inner
  return (
    <motion.span ref={wrap} onPointerMove={onMove} onPointerLeave={onLeave} style={{ x: sx, y: sy }} className="inline-flex">
      {inner}
    </motion.span>
  )
})

/** Square icon-only button. `label` is required for screen readers. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ComponentPropsWithoutRef<'button'>, 'children'> & {
  label: string; icon: ReactNode; variant?: 'ghost' | 'secondary'; size?: 'sm' | 'md'
}>(function IconButton({ label, icon, variant = 'ghost', size = 'md', className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'press inline-flex shrink-0 items-center justify-center rounded-xl text-slate-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300/80',
        variant === 'ghost' ? 'hover:bg-white/[0.07]' : 'glass-subtle hover:border-white/20 hover:bg-white/[0.07]',
        size === 'md' ? 'size-11' : 'size-9',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
})
