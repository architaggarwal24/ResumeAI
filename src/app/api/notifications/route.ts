// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NotificationType } from '@/types/resume'

// GET /api/notifications — fetch recent notifications
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      type: NotificationType
      title: string
      body: string
      href?: string
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({ user_id: user.id, type: body.type, title: body.title, body: body.body, href: body.href ?? null })
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
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { ids?: string[]; all?: boolean }

    if (body.all) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    } else if (body.ids?.length) {
      await supabase.from('notifications').update({ read: true }).in('id', body.ids).eq('user_id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 })
  }
}
