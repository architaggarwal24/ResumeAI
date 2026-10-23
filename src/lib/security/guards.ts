// src/lib/security/guards.ts
// Route-handler helpers: authenticated user, per-user rate limits, bounded JSON.
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRateLimiter, type RateDecision } from './rate-limit'
import { readJsonLimited } from './body'

// Best-effort, per-instance limits (see rate-limit.ts). Tune per deployment.
export const limiters = {
  ai:          createRateLimiter({ limit: 20, windowMs: 60_000 }),  // analyze / tailor / cover-letter / interview / linkedin / chat
  llmProxy:    createRateLimiter({ limit: 30, windowMs: 60_000 }),  // /api/llm
  testConn:    createRateLimiter({ limit: 6,  windowMs: 60_000 }),
  export:      createRateLimiter({ limit: 20, windowMs: 60_000 }),
  write:       createRateLimiter({ limit: 120, windowMs: 60_000 }), // CRUD writes
  shareCreate: createRateLimiter({ limit: 20, windowMs: 3_600_000 }),
  shareUnlock: createRateLimiter({ limit: 8,  windowMs: 60_000, maxKeys: 20_000 }), // per ip+slug
} as const

export const MAX_BODY = {
  small: 32 * 1024,       // CRUD metadata
  resume: 512 * 1024,     // resume JSON (+raw text)
  ai: 768 * 1024,         // resume + job description + history
} as const

export async function getAuthedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

export function rateLimitResponse(d: RateDecision): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests — slow down and retry shortly' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(d.retryAfterMs / 1000)) } },
  )
}

/** Returns a 429 response if over the limit, otherwise null. */
export function limit(limiter: { check(key: string): RateDecision }, key: string): NextResponse | null {
  const d = limiter.check(key)
  return d.allowed ? null : rateLimitResponse(d)
}

export async function parseBody<T = unknown>(
  req: NextRequest | Request, maxBytes: number,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const r = await readJsonLimited<T>(req, maxBytes)
  if (r.ok) return r
  return { ok: false, response: NextResponse.json({ error: r.error }, { status: r.status }) }
}

/** First hop of x-forwarded-for. Only meaningful behind a trusted proxy (Vercel/Netlify set it). */
export function clientIp(req: NextRequest | Request): string {
  const xff = req.headers.get('x-forwarded-for')
  return (xff?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown').slice(0, 64)
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

/** True if `resumeId` is a UUID owned by `userId`. Defence-in-depth on top of RLS. */
export async function ownsResume(
  supabase: Awaited<ReturnType<typeof createClient>>, resumeId: string, userId: string,
): Promise<boolean> {
  if (!isUuid(resumeId)) return false
  const { data } = await supabase.from('resumes').select('id').eq('id', resumeId).eq('user_id', userId).maybeSingle()
  return !!data
}
