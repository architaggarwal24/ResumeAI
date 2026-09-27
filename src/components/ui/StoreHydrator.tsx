// src/components/ui/StoreHydrator.tsx
'use client'
import { useEffect } from 'react'
import { useResumeStore } from '@/store/resumeStore'

export function StoreHydrator() {
  const hydrateFromStorage = useResumeStore(s => s.hydrateFromStorage)
  useEffect(() => { hydrateFromStorage() }, []) // eslint-disable-line
  return null
}