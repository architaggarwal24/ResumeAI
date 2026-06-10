import { cn, strengthColor } from '@/lib/utils'
import type { Strength } from '@/types/resume'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'ghost', size = 'md', loading, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-lg transition-all cursor-pointer select-none',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30 hover:-translate-y-px',
        variant === 'ghost'   && 'bg-transparent hover:bg-white/5 text-slate-300 border border-white/8 hover:border-white/15',
        variant === 'danger'  && 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
        variant === 'success' && 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20',
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={13} className="spin" />}
      {children}
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, className, ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-[#16161d] border border-white/7 rounded-xl p-5 transition-colors hover:border-white/10', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardSm({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-[#16161d] border border-white/7 rounded-lg p-3.5', className)}>
      {children}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function StrengthBadge({ strength }: { strength: Strength }) {
  const { text, bg } = strengthColor(strength)
  const labels = { strong: 'Strong', ok: 'OK', weak: 'Weak' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium border', text, bg)}>
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
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono border',
      variant === 'default' && 'bg-white/5 text-slate-400 border-white/10',
      variant === 'high'    && 'bg-red-400/10 text-red-400 border-red-400/20',
      variant === 'medium'  && 'bg-amber-400/10 text-amber-400 border-amber-400/20',
      variant === 'low'     && 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
      variant === 'success' && 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
      variant === 'error'   && 'bg-red-400/10 text-red-400 border-red-400/20',
    )}>
      {children}
    </span>
  )
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

export function ScoreBar({ value, color }: { value: number; color?: string }) {
  const barColor = color || (value >= 70 ? '#34d399' : value >= 45 ? '#fbbf24' : '#f87171')
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: barColor }}
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
    <details open={defaultOpen} className="group border border-white/7 rounded-xl overflow-hidden mb-3">
      <summary className="flex items-center gap-2.5 px-4 py-3 bg-[#1c1c24] cursor-pointer list-none hover:bg-[#1f1f28] transition-colors">
        {icon}
        <span className="font-medium text-sm text-slate-200 flex-1">{title}</span>
        {badge}
        {actions && <div onClick={e => e.preventDefault()}>{actions}</div>}
        <svg className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="p-4 bg-[#16161d]">
        {children}
      </div>
    </details>
  )
}

// ─── Label ────────────────────────────────────────────────────────────────────

export function Label({ children }: { children: ReactNode }) {
  return <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">{children}</p>
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider() {
  return <hr className="border-none border-t border-white/7 my-4" />
}
