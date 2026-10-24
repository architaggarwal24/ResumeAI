// src/components/resume/DeleteResumeButton.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

// Inline confirm that morphs in place with a draining timer (Arc "confirm morph").
const CONFIRM_MS = 4000

export function DeleteResumeButton({ resumeId }: { resumeId: string }) {
  const router  = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading]       = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  function stop(e: React.SyntheticEvent) { e.preventDefault(); e.stopPropagation() }

  function ask(e: React.MouseEvent) {
    stop(e)
    setConfirming(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setConfirming(false), CONFIRM_MS)
  }
  function cancel(e: React.MouseEvent) { stop(e); window.clearTimeout(timer.current); setConfirming(false) }
  async function confirm(e: React.MouseEvent) {
    stop(e)
    window.clearTimeout(timer.current)
    setLoading(true)
    await fetch(`/api/resume/${resumeId}`, { method: 'DELETE' })
    router.refresh()
  }

  if (!confirming) {
    return (
      <button onClick={ask} disabled={loading} aria-label="Delete resume"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
        <Trash2 size={11} />Delete
      </button>
    )
  }
  return (
    <div role="alertdialog" aria-label="Confirm delete" onClick={stop}
      className="pop relative flex items-center overflow-hidden rounded-lg border border-red-500/30 bg-red-500/10 text-xs">
      <span className="pl-2 pr-1 text-red-300">Delete?</span>
      <button onClick={confirm} disabled={loading} className="px-2 py-1 font-semibold text-red-300 hover:bg-red-500/20 transition-colors">
        {loading ? '…' : 'Yes'}
      </button>
      <button onClick={cancel} className="px-2 py-1 text-slate-400 hover:bg-white/5 transition-colors">No</button>
      <span aria-hidden className="absolute bottom-0 left-0 h-0.5 bg-red-400/70" style={{ animation: `shrink ${CONFIRM_MS}ms linear forwards` }} />
    </div>
  )
}
