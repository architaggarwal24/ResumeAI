// src/app/api/share/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, ownsResume, isUuid, MAX_BODY } from '@/lib/security/guards'

const MIN_SHARE_PASSWORD = 6
const MAX_SHARE_PASSWORD = 128   // bcrypt only uses the first 72 bytes; cap well above that
const MAX_EXPIRY_DAYS = 365
const MAX_SHARES_PER_RESUME = 25

function generateSlug(): string {
  return randomBytes(9).toString('base64url') // 72 bits (was 48)
}

// GET /api/share?resumeId=xxx — get existing shares for a resume
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()

    const resumeId = request.nextUrl.searchParams.get('resumeId')
    if (!isUuid(resumeId)) return NextResponse.json({ error: 'resumeId required' }, { status: 400 })

    const { data } = await supabase
      .from('resume_shares')
      .select('id, slug, view_count, expires_at, created_at, password_hash')
      .eq('resume_id', resumeId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const shares = (data ?? []).map(s => ({
      id: s.id,
      slug: s.slug,
      viewCount: s.view_count,
      expiresAt: s.expires_at,
      hasPassword: !!s.password_hash,
      createdAt: s.created_at,
      url: `${request.nextUrl.origin}/s/${s.slug}`,
    }))

    return NextResponse.json({ shares })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 })
  }
}

// POST /api/share — create a share link
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    const limited = limit(limiters.shareCreate, user.id)
    if (limited) return limited

    const parsed = await parseBody<{ resumeId?: unknown; password?: unknown; expiresInDays?: unknown }>(request, MAX_BODY.small)
    if (!parsed.ok) return parsed.response
    const body = parsed.data ?? {}

    if (!isUuid(body.resumeId)) return NextResponse.json({ error: 'resumeId required' }, { status: 400 })

    // Verify ownership
    if (!(await ownsResume(supabase, body.resumeId, user.id))) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    const { count } = await supabase.from('resume_shares').select('id', { count: 'exact', head: true }).eq('resume_id', body.resumeId)
    if ((count ?? 0) >= MAX_SHARES_PER_RESUME) {
      return NextResponse.json({ error: `Share link limit reached (${MAX_SHARES_PER_RESUME}). Revoke old links first.` }, { status: 409 })
    }

    // Password: optional, but if present it must be a real password.
    let password: string | null = null
    if (body.password !== undefined && body.password !== null && body.password !== '') {
      if (typeof body.password !== 'string' || body.password.length < MIN_SHARE_PASSWORD || body.password.length > MAX_SHARE_PASSWORD) {
        return NextResponse.json({ error: `Password must be ${MIN_SHARE_PASSWORD}–${MAX_SHARE_PASSWORD} characters` }, { status: 400 })
      }
      password = body.password
    }

    // Expiry: a positive whole number of days, bounded (previously unvalidated; huge or
    // negative values produced an Invalid Date and a 500).
    let expiresAt: string | null = null
    if (body.expiresInDays !== undefined && body.expiresInDays !== null && body.expiresInDays !== '') {
      const days = body.expiresInDays
      if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > MAX_EXPIRY_DAYS) {
        return NextResponse.json({ error: `Expiry must be a whole number of days from 1 to ${MAX_EXPIRY_DAYS}` }, { status: 400 })
      }
      expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString()
    }

    const slug = generateSlug()

    // Bcrypt via Postgres pgcrypto (supabase/migrations/002_secure_share_access.sql).
    let passwordHash: string | null = null
    if (password) {
      const { data: hash, error: hashError } = await supabase.rpc('hash_share_password', { p_password: password })
      if (hashError || typeof hash !== 'string') {
        console.error('[POST /api/share] hash_share_password failed:', hashError?.code)
        return NextResponse.json({ error: 'Failed to create share' }, { status: 500 })
      }
      passwordHash = hash
    }

    const { data, error } = await supabase
      .from('resume_shares')
      .insert({ resume_id: body.resumeId, user_id: user.id, slug, password_hash: passwordHash, expires_at: expiresAt })
      .select('id, slug, view_count, expires_at, created_at')
      .single()

    if (error || !data) throw error ?? new Error('insert failed')

    // Same camelCase shape as GET, and never the password hash.
    const url = `${request.nextUrl.origin}/s/${slug}`
    return NextResponse.json({
      share: {
        id: data.id, slug: data.slug, viewCount: data.view_count ?? 0,
        expiresAt: data.expires_at, hasPassword: !!passwordHash, createdAt: data.created_at, url,
      },
      url,
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/share]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Failed to create share' }, { status: 500 })
  }
}

// DELETE /api/share?id=xxx — revoke a share
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()

    const id = request.nextUrl.searchParams.get('id')
    if (!isUuid(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await supabase.from('resume_shares').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 })
  }
}
