import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; versionId: string }> }

// GET /api/resume/[id]/versions/restore/[versionId] — fetch full version data for diff/preview
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id, versionId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Ownership check via RLS on versions table
    const { data, error } = await supabase
      .from('resume_versions')
      .select('*')
      .eq('id', versionId)
      .eq('resume_id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    return NextResponse.json({ version: data })
  } catch (err) {
    console.error('[GET /api/resume/[id]/versions/restore/[versionId]]', err)
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 })
  }
}

// POST /api/resume/[id]/versions/restore/[versionId] — restore version as current resume
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id, versionId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch the target version (RLS ensures ownership)
    const { data: version, error: vErr } = await supabase
      .from('resume_versions')
      .select('parsed_data, ats_score, label')
      .eq('id', versionId)
      .eq('resume_id', id)
      .single()

    if (vErr || !version) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

    // Before restoring, snapshot the current state
    const { data: current } = await supabase
      .from('resumes')
      .select('parsed_data, ats_score')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (current) {
      await supabase.from('resume_versions').insert({
        resume_id: id,
        label: `Auto-snapshot before restore`,
        parsed_data: current.parsed_data,
        ats_score: current.ats_score,
      })
    }

    // Restore the target version
    const { data: updated, error: updateErr } = await supabase
      .from('resumes')
      .update({
        parsed_data: version.parsed_data,
        ats_score: version.ats_score,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateErr || !updated) return NextResponse.json({ error: 'Restore failed' }, { status: 500 })
    return NextResponse.json({ resume: updated, restoredFrom: version.label })
  } catch (err) {
    console.error('[POST restore]', err)
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 })
  }
}
