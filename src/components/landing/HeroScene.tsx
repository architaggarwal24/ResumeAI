'use client'
// src/components/landing/HeroScene.tsx
// The hero's "show, don't tell": a resume sheet in 3D space that scores itself.
// A scan beam reads each line, lines light up verdigris (strong) or amber (weak),
// the score orb counts up, then "fixes" apply and the score jumps — the loop's
// peak moment. Layers float at different depths and follow the cursor.
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { AnimatePresence, motion, useInView, useMotionValue, useSpring, useTransform } from 'motion/react'
import NumberFlow from '@number-flow/react'
import { Check, Sparkles, TrendingUp, Wand2 } from 'lucide-react'
import { useMotionTier } from '@/components/ui/glass/MotionTier'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Verdict = 'strong' | 'weak'
interface Line { w: number; v: Verdict; pts: number; section?: string }

const LINES: Line[] = [
  { section: 'Experience', w: 94, v: 'strong', pts: 6 },
  { w: 82, v: 'weak', pts: 2 },
  { w: 88, v: 'strong', pts: 5 },
  { w: 70, v: 'strong', pts: 4 },
  { section: 'Projects', w: 90, v: 'weak', pts: 2 },
  { w: 76, v: 'strong', pts: 5 },
  { section: 'Education', w: 64, v: 'strong', pts: 4 },
]
const BASE = 54
const SCANNED = BASE + LINES.reduce((s, l) => s + l.pts, 0) // 82
const FIXED = 91
const SCAN_STEPS = LINES.length
const TOTAL = SCAN_STEPS + 7 // scan → hold → fix → hold → reset

const KEYWORDS = ['Kubernetes', 'gRPC', 'CI/CD', 'Go']

export function HeroScene() {
  const tier = useMotionTier()
  const animated = tier !== 'off'
  const [tick, setTick] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  // Only run the loop while the scene is on screen and the tab is visible.
  const inView = useInView(ref, { amount: 0.15 })

  useEffect(() => {
    if (!animated || !inView) return
    const id = window.setInterval(() => { if (!document.hidden) setTick(s => (s + 1) % TOTAL) }, 720)
    return () => window.clearInterval(id)
  }, [animated, inView])

  // Reduced motion: show the finished, fixed state.
  const step = animated ? tick : TOTAL - 2
  const scanned = Math.min(step, SCAN_STEPS)
  const fixed = step >= SCAN_STEPS + 3
  const score = fixed
    ? FIXED
    : BASE + LINES.slice(0, scanned).reduce((s, l) => s + l.pts, 0)
  const scanning = step < SCAN_STEPS
  const showSuggestion = step >= SCAN_STEPS + 1
  const keywordsFound = Math.min(KEYWORDS.length, Math.max(0, step - 1))

  // Cursor-follow tilt (full tier only)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, SPRING.follow)
  const sy = useSpring(py, SPRING.follow)
  const rotateY = useTransform(sx, [0, 1], [-18, 6])
  const rotateX = useTransform(sy, [0, 1], [12, -2])
  const tiltOn = tier === 'full'

  function move(e: PointerEvent) {
    if (!tiltOn || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  function leave() { px.set(0.5); py.set(0.5) }

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      className="relative mx-auto aspect-[5/6] w-full max-w-[520px] [perspective:1400px] sm:aspect-[1/1]"
      role="img"
      aria-label={`Animated demo: a resume being scored. Current ATS score ${score} out of 100.`}
    >
      {/* Ground glow */}
      <div aria-hidden className="absolute inset-x-[8%] bottom-[2%] h-24 rounded-[50%] bg-[radial-gradient(closest-side,rgba(139,92,246,.35),transparent)] blur-2xl" />

      <motion.div
        aria-hidden
        className="absolute inset-0 [transform-style:preserve-3d]"
        style={tiltOn ? { rotateX, rotateY } : { rotateX: 8, rotateY: -10 }}
      >
        {/* ── The sheet ── */}
        <div className="glass-strong no-blur absolute left-[6%] top-[8%] h-[84%] w-[78%] rounded-[22px] p-4 sm:left-[9%] sm:top-[6%] sm:w-[70%] sm:p-6">
          <span className="edge" />
          {/* header */}
          <div className="mb-5 flex items-center gap-3">
            <div className="size-10 rounded-full bg-[linear-gradient(135deg,#8b5cf6,#3b0f7a)] ring-2 ring-white/10" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-2/5 rounded-full bg-white/70" />
              <div className="h-2 w-3/5 rounded-full bg-white/20" />
            </div>
          </div>

          <div className="relative space-y-2.5">
            {LINES.map((l, i) => {
              const lit = i < scanned
              const isFixed = fixed && l.v === 'weak'
              const verdict: Verdict = isFixed ? 'strong' : l.v
              return (
                <div key={i}>
                  {l.section && (
                    <p className={cn('mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]', i > 0 && 'pt-2')}>{l.section}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="size-1 shrink-0 rounded-full bg-white/30" />
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07] sm:h-2.5" style={{ maxWidth: `${l.w}%` }}>
                      <motion.div
                        className={cn('absolute inset-0 origin-left rounded-full', verdict === 'strong' ? 'bg-violet-400/80 shadow-[0_0_12px_rgba(139,92,246,.6)]' : 'bg-fuchsia-300/85 shadow-[0_0_12px_rgba(232,121,249,.55)]')}
                        initial={false}
                        animate={{ scaleX: lit ? 1 : 0, opacity: lit ? 1 : 0 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <AnimatePresence>
                      {lit && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                          transition={SPRING.bouncy}
                          className={cn('grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold', verdict === 'strong' ? 'bg-violet-400/20 text-violet-200' : 'bg-fuchsia-300/20 text-fuchsia-200')}
                        >
                          {verdict === 'strong' ? <Check className="size-2.5" strokeWidth={3} /> : '!'}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )
            })}

            {/* Scan beam */}
            {/* Moves with transform only (a full-height track shifted by %), never `top`,
                so it never triggers layout. */}
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={false}
              animate={{ y: `${(scanned / SCAN_STEPS) * 100}%`, opacity: scanning && animated ? 1 : 0 }}
              transition={{ duration: 0.7, ease: 'linear' }}
            >
              <div className="absolute -inset-x-3 top-0 h-8 -translate-y-1/2">
                <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-violet-200 to-transparent shadow-[0_0_16px_2px_rgba(167,139,250,.8)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-300/10 to-transparent" />
              </div>
            </motion.div>
          </div>

          {/* Skills chips */}
          <div className="mt-5 flex flex-wrap gap-1.5">
            {KEYWORDS.map((k, i) => (
              <span
                key={k}
                className={cn(
                  'rounded-full border px-2 py-0.5 font-mono text-[9px] transition-all duration-500 sm:text-[10px]',
                  i < keywordsFound ? 'border-violet-300/40 bg-violet-400/15 text-violet-100' : 'border-white/10 bg-white/[0.03] text-slate-500',
                )}
              >
                {k}
              </span>
            ))}
          </div>
        </div>

        {/* ── Score orb (floats in front) ── */}
        <div className="absolute right-[2%] top-[2%] [transform:translateZ(90px)]">
          <ScoreOrb score={score} fixed={fixed} />
        </div>

        {/* ── Keyword match card ── */}
        <div className="glass absolute left-[-2%] top-[40%] w-[36%] min-w-[136px] rounded-2xl p-3 [transform:translateZ(60px)] sm:left-[-6%]">
          <span className="edge" />
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-300 sm:text-[11px]"><TrendingUp className="size-3 text-violet-300" />Keyword match</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div className="h-full origin-left rounded-full bg-gradient-to-r from-violet-500 to-violet-300" initial={false} animate={{ scaleX: keywordsFound / KEYWORDS.length }} transition={SPRING.soft} />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-slate-500"><span className="text-violet-200">{keywordsFound}</span>/{KEYWORDS.length} matched</p>
        </div>

        {/* ── Suggestion card (the fix) ── */}
        <AnimatePresence>
          {showSuggestion && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.92, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
              exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.2 } }}
              transition={SPRING.soft}
              className="absolute bottom-[2%] right-0 w-[62%] min-w-[190px] [transform:translateZ(120px)] sm:w-[56%]"
            >
              <div className="glass-strong no-blur rounded-2xl p-3.5">
                <span className="edge" />
                <p className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-fuchsia-300 sm:text-[10px]">
                  {fixed ? <Sparkles className="size-3" /> : <Wand2 className="size-3" />}
                  {fixed ? 'Fix applied' : 'Quickest win'}
                </p>
                <p className="text-[12px] leading-snug text-slate-200 sm:text-[13px]">
                  {fixed ? <>“Cut API latency <span className="text-violet-200">38%</span> across 12 Go services”</> : 'Quantify the impact in your second role — recruiters skim for numbers.'}
                </p>
                <p className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px]', fixed ? 'bg-violet-400/15 text-violet-200' : 'bg-fuchsia-300/15 text-fuchsia-200')}>
                  +{FIXED - SCANNED} pts
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

function ScoreOrb({ score, fixed }: { score: number; fixed: boolean }) {
  const R = 42
  const C = 2 * Math.PI * R
  return (
    <div className="relative">
      <motion.div
        aria-hidden
        className="absolute -inset-3 rounded-full blur-xl"
        animate={{ background: fixed ? 'radial-gradient(closest-side, rgba(232,121,249,.55), transparent)' : 'radial-gradient(closest-side, rgba(139,92,246,.5), transparent)' }}
        transition={{ duration: 0.6 }}
      />
      <div className="glass-strong no-blur relative grid size-[96px] place-items-center rounded-full sm:size-[128px]">
        <span className="edge" />
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
          <defs>
            <linearGradient id="orb-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor={fixed ? '#e879f9' : '#8b5cf6'} />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="6" />
          <motion.circle
            cx="50" cy="50" r={R} fill="none" stroke="url(#orb-g)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C}
            initial={false}
            animate={{ strokeDashoffset: C * (1 - score / 100) }}
            transition={SPRING.soft}
          />
        </svg>
        <div className="text-center">
          <NumberFlow value={score} className="font-mono text-2xl font-semibold tabular-nums text-white sm:text-4xl" />
          <p className="-mt-0.5 font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-400 sm:text-[9px] sm:tracking-[0.2em]">ATS score</p>
        </div>
      </div>
    </div>
  )
}
