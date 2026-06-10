import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: resume } = await supabase
      .from('resumes').select('id').eq('id', id).eq('user_id', user.id).single()
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('resume_versions')
      .select('id, label, ats_score, created_at')
      .eq('resume_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json({ versions: data ?? [] })
  } catch (err) {
    console.error('[GET versions]', err)
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { label?: string; parsedData?: object; atsScore?: number }

    let parsedData = body.parsedData
    let atsScore   = body.atsScore ?? null

    if (!parsedData) {
      const { data: resume } = await supabase
        .from('resumes').select('parsed_data, ats_score, user_id')
        .eq('id', id).eq('user_id', user.id).single()
      if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
      parsedData = resume.parsed_data
      atsScore   = resume.ats_score
    }

    const label = body.label || `Snapshot — ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`

    const { data, error } = await supabase
      .from('resume_versions')
      .insert({ resume_id: id, label, parsed_data: parsedData, ats_score: atsScore })
      .select().single()

    if (error) throw error
    return NextResponse.json({ version: data }, { status: 201 })
  } catch (err) {
    console.error('[POST versions]', err)
    return NextResponse.json({ error: 'Failed to create version' }, { status: 500 })
  }
}
