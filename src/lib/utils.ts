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
  if (score >= 45) return 'text-amber-400'
  return 'text-red-400'
}

export function scoreBg(score: number): string {
  if (score >= 70) return 'bg-emerald-400/10 border-emerald-400/20'
  if (score >= 45) return 'bg-amber-400/10 border-amber-400/20'
  return 'bg-red-400/10 border-red-400/20'
}

export function strengthColor(s: string) {
  if (s === 'strong') return { text: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/25' }
  if (s === 'ok')     return { text: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/25'   }
  return                     { text: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/25'       }
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
