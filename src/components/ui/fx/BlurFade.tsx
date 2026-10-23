// src/components/ui/fx/BlurFade.tsx
'use client'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Scroll-reveal: fades/de-blurs children in when they enter the viewport.
// Respects prefers-reduced-motion via CSS (see .blur-fade in globals.css).
export function BlurFade({ children, delay = 0, className, as: Tag = 'div' }: {
  children: ReactNode
  /** Stagger in milliseconds. */
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'article'
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setShown(true); io.disconnect() }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as never}
      data-in={shown}
      style={{ '--d': `${delay}ms` } as CSSProperties}
      className={cn('blur-fade', className)}
    >
      {children}
    </Tag>
  )
}
