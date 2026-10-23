// src/app/api/resume/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sanitizeResumeData, isTemplateId } from '@/lib/security/resume-schema'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, isUuid, MAX_BODY } from '@/lib/security/guards'

type Params = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ error: 'Resume not found' }, { status: 404 })

// GET /api/resume/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    if (!isUuid(id)) return notFound()

    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) return notFound()
    return NextResponse.json({ resume: data })
  } catch (err) {
    console.error('[GET /api/resume/[id]]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Failed to fetch resume' }, { status: 500 })
  }
}

// PUT /api/resume/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    if (!isUuid(id)) return notFound()
    const limited = limit(limiters.write, user.id)
    if (limited) return limited

    const parsed = await parseBody<Record<string, unknown>>(request, MAX_BODY.resume)
    if (!parsed.ok) return parsed.response
    const body = (parsed.data && typeof parsed.data === 'object' ? parsed.data : {}) as Record<string, unknown>

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
      updates.name = body.name.trim().slice(0, 200)
    }
    if (body.parsedData !== undefined) {
      const pd = sanitizeResumeData(body.parsedData)
      if (!pd) return NextResponse.json({ error: 'Invalid parsedData' }, { status: 400 })
      updates.parsed_data = pd
    }
    if (body.templateId !== undefined) {
      if (!isTemplateId(body.templateId)) return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 })
      updates.template_id = body.templateId
    }
    if (body.atsScore !== undefined) {
      if (body.atsScore !== null && (typeof body.atsScore !== 'number' || !Number.isFinite(body.atsScore) || body.atsScore < 0 || body.atsScore > 100)) {
        return NextResponse.json({ error: 'Invalid atsScore' }, { status: 400 })
      }
      updates.ats_score = body.atsScore
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const { data, error } = await supabase
      .from('resumes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !data) return NextResponse.json({ error: 'Resume not found or update failed' }, { status: 404 })
    return NextResponse.json({ resume: data })
  } catch (err) {
    console.error('[PUT /api/resume/[id]]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Failed to update resume' }, { status: 500 })
  }
}

// DELETE /api/resume/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    if (!isUuid(id)) return notFound()

    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/resume/[id]]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 })
  }
}
