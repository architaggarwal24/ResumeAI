// src/components/resume/DeleteResumeButton.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Check } from 'lucide-react'
import HoldButton from '@/components/vendor/react-bits/HoldButton'

// Hold-to-delete (React Bits "Hold Button"): a destructive action that needs a
// deliberate, visible gesture instead of a click.
export function DeleteResumeButton({ resumeId }: { resumeId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    await fetch(`/api/resume/${resumeId}`, { method: 'DELETE' })
    router.refresh()
  }

  // The whole card is a link underneath — keep presses from navigating.
  return (
    <div onClick={e => { e.preventDefault(); e.stopPropagation() }}>
      <HoldButton
        size="sm" holdTime={1100} disabled={busy} onHold={remove}
        backgroundColor="rgba(248,113,113,0.10)" fillColor="#ef4444" textColor="#fca5a5" fillTextColor="#ffffff"
        icon={<Trash2 size={12} />} doneIcon={<Check size={12} />} doneLabel="Deleting…" glow={false}
      >
        Hold to delete
      </HoldButton>
    </div>
  )
}
