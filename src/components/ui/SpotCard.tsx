// src/components/ui/SpotCard.tsx
'use client'
import type { CSSProperties, ComponentProps } from 'react'
import SpotlightCard from '@/components/vendor/react-bits/SpotlightCard'
import { cn } from '@/lib/utils'

// App-styled wrapper around React Bits' SpotlightCard. The vendored component ships
// with `rounded-3xl p-8` and a #111 surface; this applies our radius, padding and
// surface colour (important modifiers because both sets are plain utilities).
export function SpotCard({ className, style, ...props }: ComponentProps<typeof SpotlightCard>) {
  return (
    <SpotlightCard
      spotlightColor="rgba(139,92,246,0.18)"
      className={cn('rounded-2xl! border border-white/10 p-5! backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_24px_60px_-30px_rgba(0,0,0,.9)]', className)}
      style={{ '--spotlight-card-surface': 'rgba(18,14,26,.62)', ...style } as CSSProperties}
      {...props}
    />
  )
}
