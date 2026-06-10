import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash, randomBytes } from 'crypto'

function generateSlug(): string {
  return randomBytes(6).toString('base64url')
}

function hashPassword(pw: string): string {
  return createHash('sha256').update(pw + process.env.NEXT_PUBLIC_SUPABASE_URL).digest('hex')
}

// GET /api/share?resumeId=xxx — get existing shares for a resume
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resumeId = request.nextUrl.searchParams.get('resumeId')
    if (!resumeId) return NextResponse.json({ error: 'resumeId required' }, { status: 400 })

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
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 })
  }
}

// POST /api/share — create a share link
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      resumeId: string
      password?: string
      expiresInDays?: number
    }

    if (!body.resumeId) return NextResponse.json({ error: 'resumeId required' }, { status: 400 })

    // Verify ownership
    const { data: resume } = await supabase
      .from('resumes').select('id').eq('id', body.resumeId).eq('user_id', user.id).single()
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })

    const slug         = generateSlug()
    const passwordHash = body.password ? hashPassword(body.password) : null
    const expiresAt    = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 86400 * 1000).toISOString()
      : null

    const { data, error } = await supabase
      .from('resume_shares')
      .insert({ resume_id: body.resumeId, user_id: user.id, slug, password_hash: passwordHash, expires_at: expiresAt })
      .select().single()

    if (error) throw error

    return NextResponse.json({
      share: { ...data, hasPassword: !!passwordHash },
      url: `${request.nextUrl.origin}/s/${slug}`,
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/share]', err)
    return NextResponse.json({ error: 'Failed to create share' }, { status: 500 })
  }
}

// DELETE /api/share?id=xxx — revoke a share
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await supabase.from('resume_shares').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 })
  }
}
