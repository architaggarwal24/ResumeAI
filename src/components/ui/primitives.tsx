// src/components/ui/primitives.tsx
// Legacy primitives used across the app, restyled onto the Glass Desk system.
// The props API is unchanged so existing screens keep working.
import { cn, strengthColor } from '@/lib/utils'
import type { Strength } from '@/types/resume'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'ghost', size = 'md', loading, children, className, disabled, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'press group relative inline-flex select-none items-center justify-center gap-1.5 rounded-xl font-medium outline-none',
        'focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-ink',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' && 'min-h-8 px-3 py-1.5 text-xs',
        size === 'md' && 'min-h-10 px-4 py-2 text-sm',
        size === 'lg' && 'min-h-12 rounded-2xl px-5 py-3 text-sm',
        variant === 'primary' &&
          'btn-sheen bg-[linear-gradient(180deg,#a78bfa_0%,#7c3aed_55%,#6d28d9_100%)] text-white ' +
          'shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_0_0_1px_rgba(167,139,250,.5),0_8px_24px_-8px_rgba(124,58,237,.75)] ' +
          'hover:shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_0_0_1px_rgba(196,181,253,.8),0_12px_36px_-8px_rgba(139,92,246,.95)]',
        variant === 'ghost' && 'glass-subtle text-slate-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-white',
        variant === 'danger' && 'border border-red-400/25 bg-red-500/10 text-red-300 hover:border-red-400/45 hover:bg-red-500/20',
        variant === 'success' && 'border border-emerald-400/25 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/45 hover:bg-emerald-500/20',
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={13} className="spin" aria-hidden />}
      {children}
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, className, ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('glass relative rounded-2xl p-5 transition-[border-color,box-shadow] duration-300 hover:border-white/[0.16]', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardSm({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('glass-subtle rounded-xl p-3.5', className)}>
      {children}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function StrengthBadge({ strength }: { strength: Strength }) {
  const { text, bg } = strengthColor(strength)
  const labels = { strong: 'Strong', ok: 'OK', weak: 'Weak' }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium', text, bg)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {labels[strength]}
    </span>
  )
}

export function Badge({ children, variant = 'default' }: {
  children: ReactNode
  variant?: 'default' | 'high' | 'medium' | 'low' | 'success' | 'error'
}) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px]',
      variant === 'default' && 'border-white/10 bg-white/[0.05] text-slate-300',
      variant === 'high'    && 'border-rose-400/25 bg-rose-400/10 text-rose-300',
      variant === 'medium'  && 'border-amber-300/25 bg-amber-300/10 text-amber-200',
      variant === 'low'     && 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
      variant === 'success' && 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
      variant === 'error'   && 'border-rose-400/25 bg-rose-400/10 text-rose-300',
    )}>
      {children}
    </span>
  )
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

export function ScoreBar({ value, color }: { value: number; color?: string }) {
  const v = Math.min(100, Math.max(0, value))
  const barColor = color || (v >= 70 ? 'linear-gradient(90deg,#10b981,#34d399)' : v >= 45 ? 'linear-gradient(90deg,#f59e0b,#fcd34d)' : 'linear-gradient(90deg,#e11d48,#fb7185)')
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
        style={{ width: `${v}%`, background: barColor }}
      />
    </div>
  )
}

// ─── Section block wrapper ────────────────────────────────────────────────────

export function SectionBlock({
  title, icon, badge, children, defaultOpen = true, actions,
}: {
  title: string
  icon?: ReactNode
  badge?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  actions?: ReactNode
}) {
  return (
    <details open={defaultOpen} className="glass group mb-3 overflow-hidden rounded-2xl">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-4 py-3 transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
        {icon}
        <span className="flex-1 text-sm font-medium text-slate-100">{title}</span>
        {badge}
        {actions && <div onClick={e => e.preventDefault()}>{actions}</div>}
        <span className="grid size-7 place-items-center rounded-full border border-white/10 text-slate-400 transition-[transform,color,border-color] duration-300 group-open:rotate-180 group-open:border-violet-300/40 group-open:text-violet-200">
          <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-white/[0.06] p-4">
        {children}
      </div>
    </details>
  )
}

// ─── Label ────────────────────────────────────────────────────────────────────

export function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">{children}</p>
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider() {
  return <hr className="my-4 h-px border-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
}
