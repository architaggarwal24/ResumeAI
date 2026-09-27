// src/app/api/share/unlock/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SharedResumeResult = {
  found: boolean
  expired?: boolean
  requiresPassword?: boolean
  unlocked?: boolean
  parsedData?: unknown
  templateId?: string
  name?: string
}

// POST /api/share/unlock — submit a password for a protected share.
// Intentionally has NO auth check: this is the public unlock step for the
// public share page, not an owner-only endpoint. It is gated by the share's
// own password, verified server-side inside get_shared_resume() — resume
// content is only ever included in the response when that function reports
// unlocked: true. This is the "small server action/API route" the share
// page's password gate calls; see src/app/s/[slug]/page.tsx and
// src/components/resume/SharePasswordGate.tsx.
export async function POST(request: NextRequest) {
  try {
    const { slug, password } = await request.json() as { slug?: string; password?: string }
    if (!slug || !password) {
      return NextResponse.json({ error: 'slug and password are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_shared_resume', { p_slug: slug, p_password: password })

    if (error) {
      console.error('[POST /api/share/unlock]', error)
      return NextResponse.json({ error: 'Failed to verify password' }, { status: 500 })
    }

    const result = data as SharedResumeResult | null

    if (!result?.found) return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    if (result.expired) return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    if (!result.unlocked) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })

    return NextResponse.json({
      unlocked: true,
      parsedData: result.parsedData,
      templateId: result.templateId,
      name: result.name,
    })
  } catch (err) {
    console.error('[POST /api/share/unlock]', err)
    return NextResponse.json({ error: 'Failed to verify password' }, { status: 500 })
  }
}