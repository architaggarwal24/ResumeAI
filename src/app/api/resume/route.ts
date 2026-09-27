// src/app/api/resume/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ResumeData, TemplateId } from '@/types/resume'

// GET /api/resume — list all resumes for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('resumes')
      .select('id, name, ats_score, template_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ resumes: data })
  } catch (err) {
    console.error('[GET /api/resume]', err)
    return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 })
  }
}

// POST /api/resume — create new resume
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      name?: string
      rawText: string
      parsedData: ResumeData
      templateId?: TemplateId
    }

    if (!body.rawText || !body.parsedData) {
      return NextResponse.json({ error: 'rawText and parsedData are required' }, { status: 400 })
    }

    const resumeName = body.name || body.parsedData.name || 'Untitled Resume'

    const { data, error } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        name: resumeName,
        raw_text: body.rawText,
        parsed_data: body.parsedData,
        template_id: body.templateId || 'classic',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ resume: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/resume]', err)
    return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 })
  }
}
