'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeleteResumeButton({ resumeId }: { resumeId: string }) {
  const router  = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading]       = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 3000); return }
    setLoading(true)
    await fetch(`/api/resume/${resumeId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
        confirming ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-500 hover:text-red-400 hover:bg-red-400/10'
      }`}
      disabled={loading}
    >
      <Trash2 size={11} />
      {confirming ? 'Confirm?' : 'Delete'}
    </button>
  )
}
