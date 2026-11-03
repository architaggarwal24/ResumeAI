// src/lib/motion-governor.ts
// Pure decision logic for the adaptive motion tier (see MotionTier.tsx).
// Heavy effects (WebGL aurora, cursor glow, tilt, frosted blur) are opt-in:
// a device must look capable AND actually hold ~60fps in a short probe.
// While running, slow samples drop it back to the light tier, and that choice
// is remembered for a week so the next visit starts smooth.

export interface DeviceHints {
  reducedMotion: boolean
  coarsePointer: boolean
  cores?: number
  memoryGb?: number        // navigator.deviceMemory (Chromium only, capped at 8)
  saveData: boolean
  width: number
  reducedTransparency: boolean
  renderer?: string | null // WebGL UNMASKED_RENDERER, when exposed
}

const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i

export function isSoftwareRenderer(renderer: string | null | undefined): boolean {
  return !!renderer && SOFTWARE_GL.test(renderer)
}

export function isCandidateForFull(h: DeviceHints): boolean {
  if (h.reducedMotion || h.coarsePointer || h.saveData || h.reducedTransparency) return false
  if ((h.cores ?? 8) < 8) return false
  if (h.memoryGb !== undefined && h.memoryGb < 8) return false
  if (h.width < 1024) return false
  if (isSoftwareRenderer(h.renderer)) return false
  return true
}

/** Frame rate needed in the start-up probe before full effects are enabled. */
export const PROBE_MIN_FPS = 50
/** While in full: below this a sample counts as a strike; two strikes → lite. */
export const SLOW_FPS = 42
/** One sample this slow drops to lite immediately. */
export const VERY_SLOW_FPS = 28

export function passesProbe(fps: number): boolean {
  return fps >= PROBE_MIN_FPS
}

export function nextTierAfterSample(tier: 'full', fps: number, strikes: number): { tier: 'full' | 'lite'; strikes: number } {
  if (fps < VERY_SLOW_FPS) return { tier: 'lite', strikes: 0 }
  if (fps < SLOW_FPS) return strikes >= 1 ? { tier: 'lite', strikes: 0 } : { tier, strikes: strikes + 1 }
  return { tier, strikes: 0 }
}

export const LITE_CACHE_KEY = 'resumeai.motion.v1'
export const LITE_CACHE_MS = 7 * 24 * 3600_000

export function readCachedLite(raw: string | null, now: number): boolean {
  if (!raw) return false
  try {
    const v = JSON.parse(raw) as { tier?: string; until?: number }
    return v.tier === 'lite' && typeof v.until === 'number' && v.until > now
  } catch {
    return false
  }
}
