'use client'
// src/lib/llm/useLocalModels.ts
// Models installed on the local server, fetched when the Local provider is selected.
import { useEffect, useState } from 'react'

export function useLocalModels(active: boolean): { models: string[]; error: string } {
  const [state, setState] = useState<{ models: string[]; error: string }>({ models: [], error: '' })
  useEffect(() => {
    if (!active) return
    let live = true
    fetch('/api/local-models')
      .then(r => r.json().catch(() => ({})))
      .then((d: { models?: string[]; error?: string }) => { if (live) setState({ models: d.models ?? [], error: d.error ?? '' }) })
      .catch(() => { if (live) setState({ models: [], error: 'Could not load local models' }) })
    return () => { live = false }
  }, [active])
  return state
}
