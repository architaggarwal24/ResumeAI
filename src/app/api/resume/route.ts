// src/app/api/resume/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sanitizeResumeData, isTemplateId } from '@/lib/security/resume-schema'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, MAX_BODY } from '@/lib/security/guards'

const MAX_RAW_TEXT = 200_000
const MAX_RESUMES_PER_USER = 200

// GET /api/resume — list all resumes for current user
export async function GET() {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()

    const { data, error } = await supabase
      .from('resumes')
      .select('id, name, ats_score, template_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ resumes: data })
  } catch (err) {
    console.error('[GET /api/resume]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 })
  }
}

// POST /api/resume — create new resume
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    const limited = limit(limiters.write, user.id)
    if (limited) return limited

    const parsed = await parseBody<Record<string, unknown>>(request, MAX_BODY.resume)
    if (!parsed.ok) return parsed.response
    const body = (parsed.data && typeof parsed.data === 'object' ? parsed.data : {}) as Record<string, unknown>

    // parsedData is stored and later rendered server-side on the public share
    // page — normalise it so stored data always has the expected shape and bounds.
    const parsedData = sanitizeResumeData(body.parsedData)
    if (typeof body.rawText !== 'string' || !body.rawText || !parsedData) {
      return NextResponse.json({ error: 'rawText and parsedData are required' }, { status: 400 })
    }

    const { count } = await supabase.from('resumes').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if ((count ?? 0) >= MAX_RESUMES_PER_USER) {
      return NextResponse.json({ error: `Resume limit reached (${MAX_RESUMES_PER_USER}). Delete some to add more.` }, { status: 409 })
    }

    const name = (typeof body.name === 'string' && body.name.trim()) || parsedData.name || 'Untitled Resume'

    const { data, error } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        name: name.slice(0, 200),
        raw_text: body.rawText.slice(0, MAX_RAW_TEXT),
        parsed_data: parsedData,
        template_id: isTemplateId(body.templateId) ? body.templateId : 'classic',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ resume: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/resume]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 })
  }
}
