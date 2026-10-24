// src/components/ui/viz/RadarChart.tsx
'use client'
import { useEffect, useState } from 'react'

// Compact radar for per-section scores (Bklit radar-chart idea). 3+ axes, 0–100.
export function RadarChart({ data, size = 240, className }: {
  data: { label: string; value: number }[]
  size?: number
  className?: string
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 60)
    return () => window.clearTimeout(id)
  }, [])

  const n = data.length
  if (n < 3) return null

  const CX = 130, CY = 130, R = 78
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const pt = (i: number, v: number) => {
    const r = (Math.max(0, Math.min(100, v)) / 100) * R
    return [CX + r * Math.cos(ang(i)), CY + r * Math.sin(ang(i))] as const
  }
  const poly = (v: (i: number) => number) => data.map((_, i) => pt(i, v(i)).join(',')).join(' ')

  return (
    <svg viewBox="0 0 260 260" width={size} height={size} className={className} role="img"
      aria-label={`Section scores: ${data.map(d => `${d.label} ${d.value}`).join(', ')}`}>
      {/* rings */}
      {[25, 50, 75, 100].map(r => (
        <polygon key={r} points={poly(() => r)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {/* spokes */}
      {data.map((_, i) => {
        const [x, y] = pt(i, 100)
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      })}
      {/* data */}
      <g style={{
        transformOrigin: `${CX}px ${CY}px`,
        transform: ready ? 'scale(1)' : 'scale(0.15)',
        opacity: ready ? 1 : 0,
        transition: 'transform .9s cubic-bezier(.3,.8,.2,1), opacity .6s ease',
      }}>
        <polygon points={poly(i => data[i].value)} fill="rgba(60,201,174,0.18)" stroke="#3cc9ae" strokeWidth="1.8" strokeLinejoin="round" />
        {data.map((d, i) => {
          const [x, y] = pt(i, d.value)
          return <circle key={d.label} cx={x} cy={y} r="3.2" fill="#0b0c0d" stroke="#72e0c8" strokeWidth="1.6"><title>{`${d.label}: ${d.value}`}</title></circle>
        })}
      </g>
      {/* labels */}
      {data.map((d, i) => {
        const a = ang(i)
        const lx = CX + (R + 20) * Math.cos(a)
        const ly = CY + (R + 20) * Math.sin(a)
        const cos = Math.cos(a)
        return (
          <text key={d.label} x={lx} y={ly} fontSize="10" fill="rgba(226,232,240,0.7)"
            textAnchor={cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'} dominantBaseline="middle" className="capitalize">
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}
