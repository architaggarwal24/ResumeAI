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
      spotlightColor="rgba(60,201,174,0.16)"
      className={cn('rounded-xl! border border-white/8 p-5!', className)}
      style={{ '--spotlight-card-surface': '#111214', ...style } as CSSProperties}
      {...props}
    />
  )
}
