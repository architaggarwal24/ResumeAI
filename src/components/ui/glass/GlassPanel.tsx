'use client'
// src/components/ui/glass/GlassPanel.tsx
// Frosted surface with a gradient hairline edge, optional cursor spotlight and
// optional 3D tilt. Tilt/spotlight only run on 'full' motion tier.
import { useRef, type ComponentPropsWithoutRef, type PointerEvent } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { cn } from '@/lib/utils'
import { useMotionTier } from './MotionTier'

type Variant = 'default' | 'strong' | 'subtle'

export interface GlassPanelProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  variant?: Variant
  spotlight?: boolean
  /** Max tilt in degrees (0 = off). */
  tilt?: number
  edge?: boolean
}

const VARIANT: Record<Variant, string> = {
  default: 'glass',
  strong: 'glass-strong no-blur', // in-flow card: dense fill, no backdrop blur
  subtle: 'glass-subtle',
}

export function GlassPanel({
  variant = 'default', spotlight = true, tilt = 0, edge = true,
  className, children, onPointerMove, onPointerLeave, style, ...rest
}: GlassPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const tier = useMotionTier()
  const canTilt = tilt > 0 && tier === 'full'

  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, { stiffness: 200, damping: 20, mass: 0.4 })
  const sy = useSpring(py, { stiffness: 200, damping: 20, mass: 0.4 })
  const rotateY = useTransform(sx, [0, 1], [-tilt, tilt])
  const rotateX = useTransform(sy, [0, 1], [tilt, -tilt])

  function move(e: PointerEvent<HTMLDivElement>) {
    onPointerMove?.(e)
    const el = ref.current
    if (!el || e.pointerType === 'touch') return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    if (spotlight) {
      el.style.setProperty('--mx', `${x * 100}%`)
      el.style.setProperty('--my', `${y * 100}%`)
    }
    if (canTilt) { px.set(x); py.set(y) }
  }
  function leave(e: PointerEvent<HTMLDivElement>) {
    onPointerLeave?.(e)
    px.set(0.5); py.set(0.5)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      style={canTilt ? { rotateX, rotateY, transformPerspective: 1000, ...style } : style}
      className={cn('relative rounded-2xl', VARIANT[variant], spotlight && 'spotlight', className)}
      {...rest}
    >
      {edge && <span aria-hidden className="edge" />}
      {children}
    </motion.div>
  )
}
