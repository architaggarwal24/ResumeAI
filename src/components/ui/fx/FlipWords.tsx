// src/components/ui/fx/FlipWords.tsx
'use client'
import { useEffect, useState } from 'react'

// Rotating word with a blur/slide crossfade (Componentry "flipping word swap").
// All words occupy one grid cell, so the box is as wide as the longest word and
// nothing reflows. Reduced-motion users just see the first word.
export function FlipWords({ words, interval = 2600, className }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (words.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setI(n => (n + 1) % words.length), interval)
    return () => window.clearInterval(id)
  }, [words.length, interval])

  return (
    <span className={`inline-grid align-baseline ${className ?? ''}`}>
      {words.map((w, idx) => (
        <span key={w} aria-hidden={idx !== i}
          className="col-start-1 row-start-1 transition-all duration-500 ease-[cubic-bezier(.3,.8,.2,1)]"
          style={{
            opacity: idx === i ? 1 : 0,
            transform: idx === i ? 'translateY(0)' : 'translateY(0.35em)',
            filter: idx === i ? 'blur(0)' : 'blur(6px)',
          }}>
          {w}
        </span>
      ))}
    </span>
  )
}
