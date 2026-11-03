'use client'
// src/components/ui/glass/MotionTier.tsx
// Decides how much motion this device gets and shares it app-wide.
//   full — capable desktop that proved it holds ~60fps: WebGL aurora, cursor
//          glow, tilt, animated aurora, frosted overlays
//   lite — everyone else (and the starting state): CSS motion only, no WebGL,
//          no backdrop blur, static background light
//   off  — prefers-reduced-motion: final states, no movement
// Mirrored to <html data-motion="…"> so CSS can tone itself down.
//
// Flow: start in lite → if the device looks capable, wait until the page is
// idle and measure the frame rate for ~1s → upgrade to full only if it holds
// ≥50fps → keep sampling every 10s while visible and fall back to lite if it
// struggles (remembered for 7 days, so the next visit starts smooth).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import {
  isCandidateForFull, passesProbe, nextTierAfterSample,
  readCachedLite, LITE_CACHE_KEY, LITE_CACHE_MS, type DeviceHints,
} from '@/lib/motion-governor'

export type MotionTier = 'full' | 'lite' | 'off'

const Ctx = createContext<MotionTier>('lite')

type NavigatorHints = Navigator & {
  deviceMemory?: number
  connection?: { saveData?: boolean }
}

function webglRenderer(): string | null {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl') as WebGLRenderingContext | null
    if (!gl) return 'software (no webgl)'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return r
  } catch {
    return null
  }
}

function hints(): DeviceHints {
  const nav = navigator as NavigatorHints
  const mq = (q: string) => window.matchMedia(q).matches
  return {
    reducedMotion: mq('(prefers-reduced-motion: reduce)'),
    coarsePointer: mq('(pointer: coarse)'),
    cores: nav.hardwareConcurrency,
    memoryGb: nav.deviceMemory,
    saveData: nav.connection?.saveData === true,
    width: window.innerWidth,
    reducedTransparency: mq('(prefers-reduced-transparency: reduce)'),
    renderer: webglRenderer(),
  }
}

/** Average fps over `ms`, or null if the tab was hidden during the sample. */
function sampleFps(ms: number): Promise<number | null> {
  return new Promise(resolve => {
    if (document.hidden) return resolve(null)
    let frames = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      else frames++
      if (document.hidden) return resolve(null)
      if (now - start < ms) requestAnimationFrame(tick)
      else resolve(frames / ((now - start) / 1000))
    }
    requestAnimationFrame(tick)
  })
}

function cachedLite(): boolean {
  try { return readCachedLite(localStorage.getItem(LITE_CACHE_KEY), Date.now()) } catch { return false }
}
function rememberLite() {
  try { localStorage.setItem(LITE_CACHE_KEY, JSON.stringify({ tier: 'lite', until: Date.now() + LITE_CACHE_MS })) } catch { /* storage blocked */ }
}

function whenIdle(ms: number): Promise<void> {
  return new Promise(resolve => {
    const go = () => window.setTimeout(resolve, ms)
    if (document.readyState === 'complete') go()
    else window.addEventListener('load', go, { once: true })
  })
}

export function MotionProvider({ children }: { children: ReactNode }) {
  // Server + first client render agree on 'lite'; upgrade after mount (no hydration drift).
  const [tier, setTier] = useState<MotionTier>('lite')

  useEffect(() => {
    let cancelled = false
    let timer = 0
    const apply = (t: MotionTier) => {
      if (cancelled) return
      setTier(t)
      document.documentElement.dataset.motion = t
    }

    async function run() {
      const h = hints()
      if (h.reducedMotion) return apply('off')
      apply('lite')
      if (!isCandidateForFull(h) || cachedLite()) return

      await whenIdle(800)
      const fps = await sampleFps(1000)
      if (cancelled || fps === null || !passesProbe(fps)) return
      apply('full')

      // Watchdog: keep checking while full effects run.
      let strikes = 0
      const check = async () => {
        if (cancelled) return
        const f = await sampleFps(1500)
        if (cancelled) return
        if (f !== null) {
          const next = nextTierAfterSample('full', f, strikes)
          strikes = next.strikes
          if (next.tier === 'lite') { rememberLite(); apply('lite'); return }
        }
        timer = window.setTimeout(check, 10_000)
      }
      timer = window.setTimeout(check, 4_000)
    }
    void run()

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => apply(mq.matches ? 'off' : 'lite')
    mq.addEventListener('change', onChange)
    return () => { cancelled = true; window.clearTimeout(timer); mq.removeEventListener('change', onChange) }
  }, [])

  return (
    <Ctx.Provider value={tier}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </Ctx.Provider>
  )
}

export function useMotionTier(): MotionTier {
  return useContext(Ctx)
}
