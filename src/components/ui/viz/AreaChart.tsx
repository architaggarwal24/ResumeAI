// src/components/ui/viz/AreaChart.tsx
'use client'
import { useId, useState } from 'react'

// Smooth area chart with draw-in line and a hover crosshair + tooltip
// (Bklit area-chart idea). Responsive: SVG scales with its container.
interface Pt { label: string; value: number }
const W = 600, H = 220
const PAD = { t: 18, r: 16, b: 30, l: 34 }

function smoothPath(pts: { x: number; y: number }[], yMin: number, yMax: number): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  const clampY = (y: number) => Math.min(yMax, Math.max(yMin, y))
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = clampY(p1.y + (p2.y - p0.y) / 6)
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = clampY(p2.y - (p3.y - p1.y) / 6)
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }
  return d
}

export function AreaChart({ data, min = 0, max = 100, className, unit = '' }: {
  data: Pt[]
  min?: number
  max?: number
  className?: string
  unit?: string
}) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [hover, setHover] = useState<number | null>(null)
  if (data.length === 0) return null

  const cw = W - PAD.l - PAD.r
  const ch = H - PAD.t - PAD.b
  const range = max - min || 1
  const xAt = (i: number) => PAD.l + (data.length === 1 ? cw / 2 : (i / (data.length - 1)) * cw)
  const yAt = (v: number) => PAD.t + ch - ((Math.max(min, Math.min(max, v)) - min) / range) * ch
  const pts = data.map((d, i) => ({ x: xAt(i), y: yAt(d.value) }))
  const line = smoothPath(pts, PAD.t, PAD.t + ch)
  const base = PAD.t + ch
  const area = `${line} L ${pts[pts.length - 1].x} ${base} L ${pts[0].x} ${base} Z`
  const step = Math.max(1, Math.ceil(data.length / 8))

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    let best = 0, bd = Infinity
    pts.forEach((p, i) => { const dd = Math.abs(p.x - x); if (dd < bd) { bd = dd; best = i } })
    setHover(best)
  }

  const h = hover !== null ? data[hover] : null

  return (
    <div className={`relative ${className ?? ''}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}
      role="img" aria-label={`Score history: ${data.map(d => `${d.label} ${d.value}`).join(', ')}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" aria-hidden>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3cc9ae" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#3cc9ae" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].filter(v => v >= min && v <= max).map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yAt(v)} y2={yAt(v)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 4" />
            <text x={PAD.l - 6} y={yAt(v) + 3} fontSize="9" textAnchor="end" fill="rgba(255,255,255,0.28)">{v}</text>
          </g>
        ))}

        {data.length > 1 && <path d={area} fill={`url(#g${gid})`} />}
        {data.length > 1 && <path d={line} pathLength={1} className="draw" fill="none" stroke="#3cc9ae" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}

        {data.map((d, i) => (i % step === 0 || i === data.length - 1) && (
          <text key={i} x={xAt(i)} y={H - 8} fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.3)">{d.label}</text>
        ))}

        {hover !== null && (
          <line x1={pts[hover].x} x2={pts[hover].x} y1={PAD.t} y2={base} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 3" />
        )}
        {pts.map((p, i) => (hover === i || i === pts.length - 1) && (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="7" fill="#3cc9ae" opacity="0.18" />
            <circle cx={p.x} cy={p.y} r="3.6" fill="#0b0c0d" stroke="#72e0c8" strokeWidth="2" />
          </g>
        ))}
      </svg>

      {h && hover !== null && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#16181b] px-2.5 py-1.5 text-center shadow-xl"
          style={{ left: `${(pts[hover].x / W) * 100}%`, top: `${(pts[hover].y / H) * 100 - 4}%` }}>
          <p className="font-mono text-sm font-bold text-slate-100">{h.value}{unit}</p>
          <p className="text-[10px] text-slate-500">{h.label}</p>
        </div>
      )}
    </div>
  )
}
