// src/components/ui/fx/AgentSteps.tsx
'use client'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// "Agent working through its steps" loader (Kokonut AI State Loading idea).
// Either drive it with a real `activeIndex`, or let it auto-advance while `running`.
export function AgentSteps({ steps, running = true, activeIndex, intervalMs = 2400, className }: {
  steps: string[]
  running?: boolean
  activeIndex?: number
  intervalMs?: number
  className?: string
}) {
  const [auto, setAuto] = useState(0)

  useEffect(() => {
    if (activeIndex !== undefined || !running) { queueMicrotask(() => setAuto(0)); return }
    const id = window.setInterval(() => setAuto(i => Math.min(i + 1, steps.length - 1)), intervalMs)
    return () => window.clearInterval(id)
  }, [activeIndex, running, steps.length, intervalMs])

  const active = Math.max(0, Math.min(activeIndex ?? auto, steps.length - 1))

  return (
    <div role="status" aria-live="polite" className={cn('rounded-xl border border-white/8 bg-[#111214] p-4', className)}>
      <span className="sr-only">{steps[active]}</span>
      <ol className="space-y-0">
        {steps.map((label, i) => {
          const state = i < active ? 'done' : i === active ? 'active' : 'todo'
          return (
            <li key={label} className="relative flex items-center gap-3 py-1.5">
              {i < steps.length - 1 && (
                <span aria-hidden className={cn('absolute left-[9px] top-[26px] h-[calc(100%-8px)] w-px', state === 'done' ? 'bg-violet-400/50' : 'bg-white/10')} />
              )}
              <span className={cn('relative flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors duration-300',
                state === 'done' && 'border-violet-400/60 bg-violet-400/15 text-violet-300',
                state === 'active' && 'border-amber-300/70 bg-amber-300/10',
                state === 'todo' && 'border-white/12 bg-transparent')}>
                {state === 'done' && <Check size={11} className="pop" />}
                {state === 'active' && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-amber-300" />}
              </span>
              <span className={cn('text-sm transition-colors duration-300',
                state === 'done' && 'text-slate-400',
                state === 'active' && 'shiny-text font-medium',
                state === 'todo' && 'text-slate-600')}>
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
