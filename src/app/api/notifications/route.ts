// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { safeInternalHref } from '@/lib/security/url'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, isUuid, MAX_BODY } from '@/lib/security/guards'
import type { NotificationType } from '@/types/resume'

const TYPES: readonly NotificationType[] = ['score_ready', 'score_drop', 'score_improve', 'job_followup', 'resume_stale', 'share_viewed', 'system']

// GET /api/notifications — fetch recent notifications
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()

    const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true'

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (unreadOnly) query = query.eq('read', false)

    const { data, error } = await query
    if (error) throw error

    const unreadCount = (data ?? []).filter(n => !n.read).length
    return NextResponse.json({ notifications: data ?? [], unreadCount })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

// POST /api/notifications — create a notification (internal use)
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    const limited = limit(limiters.write, user.id)
    if (limited) return limited

    const parsed = await parseBody<Record<string, unknown>>(request, MAX_BODY.small)
    if (!parsed.ok) return parsed.response
    const b = (parsed.data && typeof parsed.data === 'object' ? parsed.data : {}) as Record<string, unknown>

    if (!TYPES.includes(b.type as NotificationType)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    if (typeof b.title !== 'string' || !b.title.trim() || typeof b.body !== 'string') {
      return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
    }
    // href is navigated to by the client: same-origin paths only.
    let href: string | null = null
    if (b.href !== undefined && b.href !== null && b.href !== '') {
      href = safeInternalHref(b.href)
      if (!href) return NextResponse.json({ error: 'href must be an in-app path' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({ user_id: user.id, type: b.type, title: b.title.trim().slice(0, 200), body: b.body.slice(0, 2000), href })
      .select().single()

    if (error) throw error
    return NextResponse.json({ notification: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}

// PATCH /api/notifications — mark all as read, or specific IDs
export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()

    const parsed = await parseBody<{ ids?: unknown; all?: unknown }>(request, MAX_BODY.small)
    if (!parsed.ok) return parsed.response
    const b = parsed.data ?? {}

    if (b.all === true) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    } else if (Array.isArray(b.ids) && b.ids.length > 0) {
      const ids = b.ids.filter(isUuid).slice(0, 100)
      if (ids.length) await supabase.from('notifications').update({ read: true }).in('id', ids).eq('user_id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 })
  }
}
