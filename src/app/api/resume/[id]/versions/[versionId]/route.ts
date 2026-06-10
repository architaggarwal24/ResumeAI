import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; versionId: string }> }

// GET /api/resume/[id]/versions/[versionId] — full version data for diff
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id, versionId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('resume_versions')
      .select('*')
      .eq('id', versionId)
      .eq('resume_id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    return NextResponse.json({ version: data })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 })
  }
}

// POST /api/resume/[id]/versions/[versionId]/restore — restore a snapshot
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id, versionId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify resume ownership
    const { data: resume } = await supabase
      .from('resumes').select('id, user_id').eq('id', id).eq('user_id', user.id).single()
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })

    // Get version data
    const { data: version } = await supabase
      .from('resume_versions').select('*').eq('id', versionId).eq('resume_id', id).single()
    if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

    // Snapshot current state before restoring
    const { data: current } = await supabase
      .from('resumes').select('parsed_data, ats_score').eq('id', id).single()
    if (current) {
      await supabase.from('resume_versions').insert({
        resume_id: id,
        label: `Before restore to "${version.label}"`,
        parsed_data: current.parsed_data,
        ats_score: current.ats_score,
      })
    }

    // Apply the restored version
    const { data: updated, error } = await supabase
      .from('resumes')
      .update({ parsed_data: version.parsed_data, ats_score: version.ats_score })
      .eq('id', id)
      .select().single()

    if (error) throw error
    return NextResponse.json({ resume: updated, restoredFrom: version.label })
  } catch (err) {
    console.error('[POST restore version]', err)
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 })
  }
}

// DELETE /api/resume/[id]/versions/[versionId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id, versionId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await supabase.from('resume_versions').delete()
      .eq('id', versionId).eq('resume_id', id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
