// src/lib/motion.ts
// Shared motion language. Springs for anything the user touches, expo-out for
// things that arrive on their own. Exits are faster than entrances.
import type { Transition, Variants } from 'motion/react'

export const DUR = { instant: 0.12, fast: 0.2, base: 0.32, slow: 0.6 } as const

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

export const SPRING = {
  /** Buttons, toggles, tab pills — settles fast, tiny overshoot. */
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 },
  /** Panels, cards, layout shifts. */
  soft: { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 },
  /** Playful pops: badges, chips, success marks. */
  bouncy: { type: 'spring', stiffness: 420, damping: 18, mass: 0.6 },
  /** Cursor followers / magnetic pull. */
  follow: { type: 'spring', stiffness: 180, damping: 18, mass: 0.4 },
} satisfies Record<string, Transition>

/** Blur-fade up. Use with `initial="hidden" whileInView="show"`. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: DUR.slow, ease: EASE_OUT_EXPO }, transitionEnd: { filter: 'none' } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.base, ease: EASE_OUT_EXPO } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, filter: 'blur(6px)' },
  show: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: SPRING.soft, transitionEnd: { filter: 'none' } },
}

/* Lighter versions without animated blur — used unless the device runs the
 * "full" tier (animating `filter` re-rasterises the element every frame). */
export const fadeUpLite: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE_OUT_EXPO } },
}

export const scaleInLite: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: SPRING.soft },
}

export const stagger = (each = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: each, delayChildren } },
})

/** Viewport options for scroll reveals: fire once, slightly before fully visible. */
export const inViewOnce = { once: true, margin: '0px 0px -12% 0px' } as const
