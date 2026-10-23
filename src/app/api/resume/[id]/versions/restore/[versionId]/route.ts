// src/app/api/resume/[id]/versions/restore/[versionId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, limit, limiters, ownsResume, isUuid } from '@/lib/security/guards'

type Params = { params: Promise<{ id: string; versionId: string }> }

const notFound = (what = 'Version') => NextResponse.json({ error: `${what} not found` }, { status: 404 })

// GET /api/resume/[id]/versions/restore/[versionId] — fetch full version data for diff/preview
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id, versionId } = await params
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    if (!isUuid(versionId) || !(await ownsResume(supabase, id, user.id))) return notFound()

    const { data, error } = await supabase
      .from('resume_versions')
      .select('*')
      .eq('id', versionId)
      .eq('resume_id', id)
      .single()

    if (error || !data) return notFound()
    return NextResponse.json({ version: data })
  } catch (err) {
    console.error('[GET restore preview]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 })
  }
}

// POST /api/resume/[id]/versions/restore/[versionId] — restore version as current resume
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id, versionId } = await params
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()
    const limited = limit(limiters.write, user.id)
    if (limited) return limited
    if (!isUuid(versionId) || !(await ownsResume(supabase, id, user.id))) return notFound('Resume')

    const { data: version } = await supabase
      .from('resume_versions')
      .select('parsed_data, ats_score, label')
      .eq('id', versionId)
      .eq('resume_id', id)
      .single()
    if (!version) return notFound()

    const { data: current } = await supabase
      .from('resumes')
      .select('parsed_data, ats_score')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (current) {
      await supabase.from('resume_versions').insert({
        resume_id: id,
        label: 'Auto-snapshot before restore',
        parsed_data: current.parsed_data,
        ats_score: current.ats_score,
      })
    }

    const { data: updated, error: updateErr } = await supabase
      .from('resumes')
      .update({ parsed_data: version.parsed_data, ats_score: version.ats_score })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateErr || !updated) return NextResponse.json({ error: 'Restore failed' }, { status: 500 })
    return NextResponse.json({ resume: updated, restoredFrom: version.label })
  } catch (err) {
    console.error('[POST restore]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 })
  }
}
