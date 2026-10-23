// src/app/api/share/unlock/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { limit, limiters, parseBody, clientIp, MAX_BODY } from '@/lib/security/guards'
import { sanitizeResumeData, isTemplateId } from '@/lib/security/resume-schema'

type SharedResumeResult = {
  found: boolean
  expired?: boolean
  locked?: boolean
  requiresPassword?: boolean
  unlocked?: boolean
  parsedData?: unknown
  templateId?: string
  name?: string
}

const SLUG_RE = /^[A-Za-z0-9_-]{6,32}$/
const MAX_PASSWORD = 128

// POST /api/share/unlock — submit a password for a protected share.
// Intentionally has NO auth check: this is the public unlock step for the
// public share page. It is gated by the share's own password, verified
// server-side inside get_shared_resume() — resume content is only ever included
// in the response when that function reports unlocked: true.
//
// Brute-force defence is layered:
//   1. here: a per-IP+slug limiter (best-effort, per instance), and
//   2. in the database (migration 003): get_shared_resume() counts failures per
//      slug and refuses guesses during a lockout. That is the authoritative
//      control — PostgREST exposes the RPC directly with the public anon key, so
//      an attacker can bypass this route entirely.
export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody<{ slug?: unknown; password?: unknown }>(request, MAX_BODY.small)
    if (!parsed.ok) return parsed.response
    const { slug, password } = parsed.data ?? {}

    if (typeof slug !== 'string' || typeof password !== 'string' || !password) {
      return NextResponse.json({ error: 'slug and password are required' }, { status: 400 })
    }
    if (!SLUG_RE.test(slug) || password.length > MAX_PASSWORD) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    const limited = limit(limiters.shareUnlock, `${clientIp(request)}:${slug}`)
    if (limited) return limited

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_shared_resume', { p_slug: slug, p_password: password })

    if (error) {
      console.error('[POST /api/share/unlock]', error.code)
      return NextResponse.json({ error: 'Failed to verify password' }, { status: 500 })
    }

    const result = data as SharedResumeResult | null

    if (!result?.found) return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    if (result.expired) return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    if (result.locked) {
      return NextResponse.json({ error: 'Too many incorrect attempts. Try again in a few minutes.' }, { status: 429, headers: { 'Retry-After': '900' } })
    }
    if (!result.unlocked) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })

    const parsedData = sanitizeResumeData(result.parsedData)
    if (!parsedData) return NextResponse.json({ error: 'Share not found' }, { status: 404 })

    return NextResponse.json({
      unlocked: true,
      parsedData,
      templateId: isTemplateId(result.templateId) ? result.templateId : 'classic',
      name: typeof result.name === 'string' ? result.name.slice(0, 200) : '',
    })
  } catch (err) {
    console.error('[POST /api/share/unlock]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Failed to verify password' }, { status: 500 })
  }
}
