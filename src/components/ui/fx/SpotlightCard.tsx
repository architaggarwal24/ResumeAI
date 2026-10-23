// src/components/ui/fx/SpotlightCard.tsx
'use client'
import { useRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Card with a cursor-following glow + gradient border. Pointer position is
// written to CSS variables directly (no React re-render on mouse move).
export function SpotlightCard({ children, className, ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={cn('spotlight bg-[#16161d] border border-white/7 rounded-xl transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30', className)}
      {...props}
    >
      {children}
    </div>
  )
}
