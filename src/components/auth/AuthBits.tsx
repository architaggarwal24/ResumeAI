'use client'
// src/components/auth/AuthBits.tsx
// Small pieces shared by login + signup.
import { AnimatePresence, motion } from 'motion/react'
import { Eye, EyeOff, Globe } from 'lucide-react'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function OAuthButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="press glass-subtle flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl text-sm font-medium text-slate-100 hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-50"
    >
      <Globe size={16} className="text-violet-300" />{children}
    </button>
  )
}

export function OrDivider({ label = 'or with email' }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-slate-500" role="separator">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
      {label}
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
    </div>
  )
}

export function RevealToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
      aria-pressed={shown}
      className="press grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.07] hover:text-white"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={shown ? 'h' : 's'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.12 }}>
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

export function FormError({ message }: { message: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={SPRING.soft}
          className="overflow-hidden rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

/** 0–4 heuristic; only guidance, the real rule is 8+ characters. */
export function passwordScore(p: string): number {
  if (!p) return 0
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++
  return Math.max(1, s)
}

const LABELS = ['', 'Too weak', 'Okay', 'Good', 'Strong']
const COLORS = ['', 'bg-rose-400', 'bg-amber-300', 'bg-violet-400', 'bg-emerald-400']

export function StrengthMeter({ password }: { password: string }) {
  const score = passwordScore(password)
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map(i => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.span
              className={cn('block h-full rounded-full', COLORS[score])}
              initial={false}
              animate={{ scaleX: i <= score ? 1 : 0 }}
              style={{ originX: 0 }}
              transition={SPRING.snappy}
            />
          </span>
        ))}
      </div>
      <span className="w-16 text-right text-[11px] text-slate-400">{password ? LABELS[score] : '8+ chars'}</span>
    </div>
  )
}
