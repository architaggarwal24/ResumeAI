// src/components/ui/fx/CopyButton.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

// Copy button whose icon pops to a check (Unlumen copy-button idea).
export function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied', className }: {
  value: string; label?: string; copiedLabel?: string; className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable (insecure context / permission) */ }
  }

  return (
    <button type="button" onClick={copy} aria-live="polite"
      className={cn('shrink-0 text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors',
        copied ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5', className)}>
      <span key={copied ? 'c' : 'n'} className="pop inline-flex">{copied ? <Check size={11} /> : <Copy size={11} />}</span>
      {copied ? copiedLabel : label}
    </button>
  )
}
