// src/components/ui/viz/ActivityCalendar.tsx
'use client'

// Contribution-style calendar (Componentry "GitHub Calendar" idea).
// `counts` is keyed by local-date "YYYY-MM-DD" (see lib/dates.ts).
import { dayKey } from '@/lib/dates'

const LEVELS = ['bg-white/[0.05]', 'bg-violet-400/30', 'bg-violet-400/55', 'bg-violet-400/80', 'bg-violet-300']
const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4)

export function ActivityCalendar({ counts, weeks = 22, noun = 'analyses' }: {
  counts: Record<string, number>
  weeks?: number
  noun?: string
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Grid ends on the current week (Sun-start columns), `weeks` columns wide.
  const end = new Date(today)
  end.setDate(end.getDate() + (6 - end.getDay()))
  const start = new Date(end)
  start.setDate(start.getDate() - weeks * 7 + 1)

  const cols: { date: Date; n: number; future: boolean }[][] = []
  const cur = new Date(start)
  for (let w = 0; w < weeks; w++) {
    const col: { date: Date; n: number; future: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      col.push({ date: new Date(cur), n: counts[dayKey(cur)] ?? 0, future: cur > today })
      cur.setDate(cur.getDate() + 1)
    }
    cols.push(col)
  }

  const total = cols.flat().reduce((s, c) => s + c.n, 0)
  const months = cols.map((col, i) => {
    const m = col[0].date.getMonth()
    const prev = i > 0 ? cols[i - 1][0].date.getMonth() : -1
    return m !== prev ? col[0].date.toLocaleString('en-US', { month: 'short' }) : ''
  })

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          <div className="mb-1 flex gap-[3px] pl-0 text-[9px] text-slate-600">
            {months.map((m, i) => <div key={i} className="w-[11px] shrink-0 overflow-visible whitespace-nowrap">{m}</div>)}
          </div>
          <div className="flex gap-[3px]" role="img" aria-label={`${total} ${noun} in the last ${weeks} weeks`}>
            {cols.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map((c, j) => (
                  <div key={j}
                    title={c.future ? undefined : `${c.n} ${noun} · ${c.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    className={`h-[11px] w-[11px] rounded-[3px] transition-transform hover:scale-125 ${c.future ? 'opacity-0' : LEVELS[level(c.n)]}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600">
        <span>{total} {noun} in the last {weeks} weeks</span>
        <span className="flex items-center gap-1">Less {LEVELS.map((l, i) => <i key={i} className={`h-[10px] w-[10px] rounded-[2px] ${l}`} />)} More</span>
      </div>
    </div>
  )
}
