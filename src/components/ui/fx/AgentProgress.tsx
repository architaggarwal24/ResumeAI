// src/components/ui/fx/AgentProgress.tsx
'use client'
import { useEffect, useState } from 'react'
import AILoadingState, { type AgentStep } from '@/components/vendor/kokonut/ai-loading'

// Drives Kokonut UI's "AI loading state" from a list of step labels.
// Pass `activeIndex` when real progress is known (e.g. PDF → parse → save);
// otherwise it advances on a timer while `running`.
export interface ProgressStep { label: string; detail?: string[] }

export function AgentProgress({ steps, running = true, activeIndex, intervalMs = 2800, className }: {
  steps: ProgressStep[]
  running?: boolean
  activeIndex?: number
  intervalMs?: number
  className?: string
}) {
  const [auto, setAuto] = useState(0)

  useEffect(() => {
    if (activeIndex !== undefined || !running) { queueMicrotask(() => setAuto(0)); return }
    const id = window.setInterval(() => setAuto(i => Math.min(i + 1, steps.length - 1)), intervalMs)
    return () => window.clearInterval(id)
  }, [activeIndex, running, steps.length, intervalMs])

  const active = Math.max(0, Math.min(activeIndex ?? auto, steps.length - 1))
  const mapped: AgentStep[] = steps.map((s, i) => ({
    id: `step-${i}`,
    label: s.label,
    detail: s.detail,
    status: i < active ? 'done' : i === active ? 'running' : 'pending',
  }))

  return (
    <div className={className}>
      <AILoadingState steps={mapped} collapseWhenDone={false} />
    </div>
  )
}
