// src/components/ui/fx/Magnetic.tsx
'use client'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Child drifts toward the pointer (Kokonut "magnet button" / React Bits "Magnet").
export function Magnetic({ children, strength = 0.28, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'touch') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`
  }
  function leave() { if (ref.current) ref.current.style.transform = '' }

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave}
      className={cn('inline-block transition-transform duration-200 ease-out will-change-transform motion-reduce:!transform-none', className)}>
      {children}
    </div>
  )
}
