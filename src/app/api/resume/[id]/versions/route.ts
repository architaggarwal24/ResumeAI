// src/app/api/resume/[id]/versions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sanitizeResumeData } from '@/lib/security/resume-schema'
import { getAuthedUser, unauthorized, limit, limiters, parseBody, ownsResume, MAX_BODY } from '@/lib/security/guards'

type Params = { params: Promise<{ id: string }> }

const MAX_VERSIONS_PER_RESUME = 100
const notFound = () => NextResponse.json({ error: 'Resume not found' }, { status: 404 })

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    if (!(await ownsResume(supabase, id, user.id))) return notFound()

    const { data, error } = await supabase
      .from('resume_versions')
      .select('id, label, ats_score, created_at')
      .eq('resume_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json({ versions: data ?? [] })
  } catch (err) {
    console.error('[GET versions]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    const limited = limit(limiters.write, user.id)
    if (limited) return limited

    // Ownership is verified up front (RLS also enforces it) — not only on the
    // branch that reads the resume.
    if (!(await ownsResume(supabase, id, user.id))) return notFound()

    const parsed = await parseBody<Record<string, unknown>>(request, MAX_BODY.resume)
    if (!parsed.ok) return parsed.response
    const body = (parsed.data && typeof parsed.data === 'object' ? parsed.data : {}) as Record<string, unknown>

    const { count } = await supabase.from('resume_versions').select('id', { count: 'exact', head: true }).eq('resume_id', id)
    if ((count ?? 0) >= MAX_VERSIONS_PER_RESUME) {
      return NextResponse.json({ error: `Snapshot limit reached (${MAX_VERSIONS_PER_RESUME}). Delete old snapshots first.` }, { status: 409 })
    }

    let parsedData = body.parsedData !== undefined ? sanitizeResumeData(body.parsedData) : null
    let atsScore: number | null = typeof body.atsScore === 'number' && Number.isFinite(body.atsScore) && body.atsScore >= 0 && body.atsScore <= 100
      ? body.atsScore : null

    if (body.parsedData !== undefined && !parsedData) return NextResponse.json({ error: 'Invalid parsedData' }, { status: 400 })

    if (!parsedData) {
      const { data: resume } = await supabase
        .from('resumes').select('parsed_data, ats_score')
        .eq('id', id).eq('user_id', user.id).single()
      if (!resume) return notFound()
      parsedData = sanitizeResumeData(resume.parsed_data)
      atsScore   = resume.ats_score
    }

    const label = (typeof body.label === 'string' && body.label.trim())
      ? body.label.trim().slice(0, 200)
      : `Snapshot — ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`

    const { data, error } = await supabase
      .from('resume_versions')
      .insert({ resume_id: id, label, parsed_data: parsedData, ats_score: atsScore })
      .select().single()

    if (error) throw error
    return NextResponse.json({ version: data }, { status: 201 })
  } catch (err) {
    console.error('[POST versions]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Failed to create version' }, { status: 500 })
  }
}
