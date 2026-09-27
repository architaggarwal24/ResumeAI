// src/app/api/resume/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ResumeData, TemplateId } from '@/types/resume'

type Params = { params: Promise<{ id: string }> }

// GET /api/resume/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    return NextResponse.json({ resume: data })
  } catch (err) {
    console.error('[GET /api/resume/[id]]', err)
    return NextResponse.json({ error: 'Failed to fetch resume' }, { status: 500 })
  }
}

// PUT /api/resume/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as Partial<{
      name: string
      parsedData: ResumeData
      templateId: TemplateId
      atsScore: number
    }>

    const updates: Record<string, unknown> = {}
    if (body.name       !== undefined) updates.name        = body.name
    if (body.parsedData !== undefined) updates.parsed_data = body.parsedData
    if (body.templateId !== undefined) updates.template_id = body.templateId
    if (body.atsScore   !== undefined) updates.ats_score   = body.atsScore

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
    console.error('[PUT /api/resume/[id]]', err)
    return NextResponse.json({ error: 'Failed to update resume' }, { status: 500 })
  }
}

// DELETE /api/resume/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/resume/[id]]', err)
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 })
  }
}
