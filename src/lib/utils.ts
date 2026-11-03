// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400'
  if (score >= 45) return 'text-amber-300'
  return 'text-rose-400'
}

export function scoreBg(score: number): string {
  if (score >= 70) return 'bg-emerald-400/10 border-emerald-400/20'
  if (score >= 45) return 'bg-amber-300/10 border-amber-300/25'
  return 'bg-rose-400/10 border-rose-400/25'
}

export function strengthColor(s: string) {
  if (s === 'strong') return { text: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/25' }
  if (s === 'ok')     return { text: 'text-amber-300',   bg: 'bg-amber-300/10 border-amber-300/25'   }
  return                     { text: 'text-rose-400',     bg: 'bg-rose-400/10 border-rose-400/25'     }
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
