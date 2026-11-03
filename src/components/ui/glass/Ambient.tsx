'use client'
// src/components/ui/glass/Ambient.tsx
// Page-level atmosphere: aurora backdrop (WebGL on 'full', CSS otherwise),
// cursor glow, and a scroll progress hairline.
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { motion, useMotionValue, useScroll, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'
import { useMotionTier } from './MotionTier'

const SoftAurora = dynamic(() => import('@/components/vendor/react-bits/SoftAurora'), { ssr: false })

/** Layered aurora. Pass `webgl` to allow the shader version on capable devices. */
export function AuroraBackdrop({ webgl = false, className, intensity = 1 }: { webgl?: boolean; className?: string; intensity?: number }) {
  const tier = useMotionTier()
  const [ready, setReady] = useState(false)
  // Let first paint happen on the cheap CSS version, then fade in WebGL.
  useEffect(() => {
    if (!webgl || tier !== 'full') return
    const id = window.setTimeout(() => setReady(true), 250)
    return () => window.clearTimeout(id)
  }, [webgl, tier])

  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} style={{ opacity: intensity }}>
      <div className="aurora-field"><i /><i /><i /></div>
      {webgl && tier === 'full' && ready && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6 }} className="absolute inset-0">
          <SoftAurora
            color1="#8b5cf6" color2="#3b0f7a" spectrum={0} brightness={0.7} opacity={0.6}
            scale={1.25} bandHeight={0.55} bandSpread={1.6} speed={0.45}
            enableMouseInteraction mouseInfluence={0.35} className="h-full w-full"
          />
        </motion.div>
      )}
    </div>
  )
}

/** Soft verdigris light that trails the cursor (full tier, fine pointer only). */
export function CursorGlow({ size = 520 }: { size?: number }) {
  const tier = useMotionTier()
  const x = useMotionValue(-1000)
  const y = useMotionValue(-1000)
  const sx = useSpring(x, { stiffness: 120, damping: 20, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 120, damping: 20, mass: 0.6 })

  useEffect(() => {
    if (tier !== 'full') return
    const move = (e: PointerEvent) => { x.set(e.clientX - size / 2); y.set(e.clientY - size / 2) }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [tier, size, x, y])

  if (tier !== 'full') return null
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-0 rounded-full will-change-transform"
      style={{
        x: sx, y: sy, width: size, height: size,
        background: 'radial-gradient(closest-side, rgba(139,92,246,.10), rgba(232,121,249,.03) 55%, transparent)',
      }}
    />
  )
}

/** Hairline at the very top that fills with scroll progress (Goal-Gradient). */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.3 })
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[70] h-[2px] origin-left bg-gradient-to-r from-violet-400 via-violet-300 to-fuchsia-300"
      style={{ scaleX }}
    />
  )
}

/** Static soft light behind a section so the page never goes flat black. */
export function SectionGlow({ side = 'left', tone = 'v', className }: { side?: 'left' | 'right' | 'center'; tone?: 'v' | 'a'; className?: string }) {
  const pos = side === 'left' ? 'left-[-10%] top-[10%]' : side === 'right' ? 'right-[-10%] top-[20%]' : 'left-1/2 top-[15%] -translate-x-1/2'
  const color = tone === 'v' ? 'rgba(139,92,246,.16)' : 'rgba(232,121,249,.10)'
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute -z-10 h-[60vmax] w-[60vmax] rounded-full', pos, className)}
      style={{ background: `radial-gradient(closest-side, ${color}, transparent)` }}
    />
  )
}
