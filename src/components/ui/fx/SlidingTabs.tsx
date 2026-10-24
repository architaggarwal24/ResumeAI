// src/components/ui/fx/SlidingTabs.tsx
'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Tab bar with a gliding active indicator and a hover pill that follows the
// pointer (Kokonut "swipe tabs", SmoothUI tabs, Unlumen "highlight" ideas).
// Arrow keys / Home / End move between tabs.
type Box = { left: number; width: number }

export function SlidingTabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: { id: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const [bar, setBar] = useState<Box | null>(null)
  const [hover, setHover] = useState<Box | null>(null)

  useEffect(() => {
    const measure = () => {
      const el = refs.current.get(value)
      if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth })
    }
    measure()
    const parent = refs.current.get(value)?.parentElement
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (parent && ro) ro.observe(parent)
    window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [value, tabs])

  function onKeyDown(e: React.KeyboardEvent) {
    const i = tabs.findIndex(t => t.id === value)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(tabs[next].id)
    refs.current.get(tabs[next].id)?.focus()
  }

  return (
    <div role="tablist" aria-orientation="horizontal" onKeyDown={onKeyDown} onPointerLeave={() => setHover(null)}
      className={cn('relative flex items-center gap-0.5 overflow-x-auto', className)}>
      {hover && (
        <span aria-hidden className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-md bg-white/[0.06] transition-[left,width] duration-200 ease-out"
          style={{ left: hover.left, width: hover.width }} />
      )}
      {tabs.map(t => (
        <button
          key={t.id}
          ref={el => { if (el) refs.current.set(t.id, el); else refs.current.delete(t.id) }}
          role="tab" type="button" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onPointerEnter={e => setHover({ left: e.currentTarget.offsetLeft, width: e.currentTarget.offsetWidth })}
          className={cn(
            'relative z-10 flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors',
            value === t.id ? 'text-violet-200' : 'text-slate-500 hover:text-slate-200',
          )}>
          {t.icon}{t.label}
        </button>
      ))}
      {bar && (
        <span aria-hidden className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(60,201,174,0.7)] transition-[left,width] duration-300 ease-[cubic-bezier(.3,.8,.2,1)]"
          style={{ left: bar.left, width: bar.width }} />
      )}
    </div>
  )
}
