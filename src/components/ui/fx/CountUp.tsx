// src/components/ui/fx/CountUp.tsx
'use client'
import { useEffect, useRef, useState } from 'react'

// Animates an integer from 0 to `value` once it scrolls into view.
// Server render (and reduced-motion) shows the final value, so there is no
// hydration mismatch and no content is ever hidden.
export function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return
      io.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        setN(Math.round(value * eased))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      setN(0)
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value, duration])

  return <span ref={ref} className={className}>{n}</span>
}
