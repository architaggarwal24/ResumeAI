// src/components/ui/fx/AnimatedNumber.tsx
'use client'
import { useEffect, useRef, useState } from 'react'

// Rolls a number to its new value whenever it changes (SmoothUI "Number Flow" /
// Arc "numbers that move" idea). Pass `initialFrom` to count up on first mount.
// Server render and first client render agree (both show `initialFrom ?? value`),
// reduced-motion users get the final value immediately.
export function AnimatedNumber({ value, initialFrom, duration = 800, className, format }: {
  value: number
  initialFrom?: number
  duration?: number
  className?: string
  format?: (n: number) => string
}) {
  const start = initialFrom ?? value
  const [shown, setShown] = useState(start)
  const fromRef = useRef(start)

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = value
      queueMicrotask(() => setShown(value))
      return
    }
    const from = fromRef.current
    if (from === value) return
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = Math.round(from + (value - from) * eased)
      fromRef.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{format ? format(shown) : shown}</span>
}
