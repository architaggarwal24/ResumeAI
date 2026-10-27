// src/components/ui/viz/MiniRing.tsx
'use client'
import { useEffect, useState } from 'react'
import { scoreHex } from '@/lib/score'

// Small score ring for cards and lists (Kokonut "spending ring" idea).
export function MiniRing({ score, size = 44, className }: { score: number; size?: number; className?: string }) {
  const s = Math.max(0, Math.min(100, Math.round(Number.isFinite(score) ? score : 0)))
  const [ready, setReady] = useState(false)
  useEffect(() => { const id = window.setTimeout(() => setReady(true), 50); return () => window.clearTimeout(id) }, [])
  const R = 17, C = 2 * Math.PI * R
  const color = scoreHex(s)

  return (
    <div className={`relative shrink-0 ${className ?? ''}`} style={{ width: size, height: size }} role="img" aria-label={`ATS score ${s} out of 100`}>
      <svg viewBox="0 0 44 44" width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
        <circle cx="22" cy="22" r={R} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={ready ? C * (1 - s / 100) : C}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.3,.7,.2,1)' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold" style={{ color }}>{s}</span>
    </div>
  )
}
