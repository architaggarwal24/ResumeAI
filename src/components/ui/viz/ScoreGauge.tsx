// src/components/ui/viz/ScoreGauge.tsx
'use client'
import { useEffect, useState } from 'react'
import { AnimatedNumber } from '@/components/ui/fx/AnimatedNumber'

// 270° tick-mark gauge (inspired by Bklit's gauge chart and Kokonut's rings):
// the arc sweeps in on mount and the ticks light up in sequence.
const TICKS = 45
const R = 46
const C = 2 * Math.PI * R

export function scoreHex(score: number): string {
  return score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'
}
export function scoreWord(score: number): string {
  return score >= 70 ? 'Strong' : score >= 45 ? 'Needs work' : 'Weak'
}

export function ScoreGauge({ score, size = 168, label = 'ATS score', className }: {
  score: number
  size?: number
  label?: string
  className?: string
}) {
  const s = Math.max(0, Math.min(100, Math.round(Number.isFinite(score) ? score : 0)))
  const color = scoreHex(s)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 40)
    return () => window.clearTimeout(id)
  }, [])

  const arc = 0.75 * C
  const filled = ready ? arc * (s / 100) : 0

  return (
    <div className={className} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${s} out of 100, ${scoreWord(s)}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>
          {/* ticks */}
          {Array.from({ length: TICKS }, (_, i) => {
            const a = ((135 + (i * 270) / (TICKS - 1)) * Math.PI) / 180
            const lit = ready && (i / (TICKS - 1)) * 100 <= s
            return (
              <line
                key={i}
                x1={60 + 53 * Math.cos(a)} y1={60 + 53 * Math.sin(a)}
                x2={60 + 57.5 * Math.cos(a)} y2={60 + 57.5 * Math.sin(a)}
                stroke={lit ? color : 'rgba(255,255,255,0.1)'}
                strokeWidth={i % 5 === 0 ? 1.6 : 1}
                strokeLinecap="round"
                style={{ transition: 'stroke .25s ease', transitionDelay: `${i * 16}ms` }}
              />
            )
          })}
          {/* track */}
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${arc} ${C}`} transform="rotate(135 60 60)" />
          {/* value */}
          <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${filled} ${C}`} transform="rotate(135 60 60)"
            style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.3,.7,.2,1)', filter: `drop-shadow(0 0 5px ${color}66)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <AnimatedNumber value={s} initialFrom={0} duration={1100} className="font-mono font-bold leading-none" format={n => String(n)} />
          <span className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
          <span className="mt-0.5 text-[11px] font-medium" style={{ color }}>{scoreWord(s)}</span>
        </div>
      </div>
    </div>
  )
}
