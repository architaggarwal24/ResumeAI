'use client'
// src/components/ui/glass/Reveal.tsx
// Scroll-triggered entrances. <Reveal> for blocks, <RevealGroup>/<RevealItem>
// for staggered lists, <TextReveal> for word-by-word headline blur-in.
import { motion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'
import { fadeUp, fadeUpLite, inViewOnce, stagger, scaleIn, scaleInLite, EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useMotionTier } from './MotionTier'

function useVariants(variant: 'up' | 'scale'): Variants {
  const full = useMotionTier() === 'full'
  if (variant === 'scale') return full ? scaleIn : scaleInLite
  return full ? fadeUp : fadeUpLite
}

export function Reveal({ children, className, delay = 0, variant = 'up' }: {
  children: ReactNode; className?: string; delay?: number; variant?: 'up' | 'scale'
}) {
  const v = useVariants(variant)
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={inViewOnce}
      variants={v}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}

export function RevealGroup({ children, className, each = 0.07, delay = 0 }: {
  children: ReactNode; className?: string; each?: number; delay?: number
}) {
  return (
    <motion.div className={className} initial="hidden" whileInView="show" viewport={inViewOnce} variants={stagger(each, delay)}>
      {children}
    </motion.div>
  )
}

export function RevealItem({ children, className, variant = 'up' }: { children: ReactNode; className?: string; variant?: 'up' | 'scale' }) {
  const v = useVariants(variant)
  return <motion.div className={className} variants={v}>{children}</motion.div>
}

const TAGS = { h1: motion.h1, h2: motion.h2, h3: motion.h3, p: motion.p } as const

const wordLite: Variants = {
  hidden: { opacity: 0, y: '0.35em' },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT_EXPO } },
}

const word: Variants = {
  hidden: { opacity: 0, y: '0.35em', filter: 'blur(12px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.8, ease: EASE_OUT_EXPO }, transitionEnd: { filter: 'none' } },
}

/**
 * Splits `text` into words and blurs them in. Pass `highlight` words (exact
 * match, punctuation stripped) to give them `highlightClassName`.
 * `onMount` animates immediately (above the fold) instead of on scroll.
 */
export function TextReveal({
  text, as: Tag = 'h2', className, highlight = [], highlightClassName = 'gradient-text', each = 0.06, delay = 0, onMount = false,
}: {
  text: string; as?: 'h1' | 'h2' | 'h3' | 'p'; className?: string; highlight?: string[]; highlightClassName?: string
  each?: number; delay?: number; onMount?: boolean
}) {
  const words = text.split(' ')
  const hl = new Set(highlight.map(w => w.toLowerCase()))
  const MotionTag = TAGS[Tag]
  const wv = useMotionTier() === 'full' ? word : wordLite
  return (
    <MotionTag
      className={cn('text-balance', className)}
      initial="hidden"
      {...(onMount ? { animate: 'show' } : { whileInView: 'show', viewport: inViewOnce })}
      variants={stagger(each, delay)}
      aria-label={text}
    >
      {words.map((w, i) => {
        const bare = w.replace(/[^\p{L}\p{N}’'-]/gu, '').toLowerCase()
        return (
          <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span variants={wv} className={cn('inline-block', hl.has(bare) && highlightClassName)}>
              {w}
            </motion.span>
            {i < words.length - 1 && ' '}
          </span>
        )
      })}
    </MotionTag>
  )
}
