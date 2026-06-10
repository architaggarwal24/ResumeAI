import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderFullHTML } from '@/lib/templates/render'
import type { ResumeData, TemplateId } from '@/types/resume'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      resumeData: ResumeData
      templateId: TemplateId
      format: 'html' | 'docx' | 'txt'
    }

    if (!body.resumeData || !body.templateId) {
      return NextResponse.json({ error: 'resumeData and templateId required' }, { status: 400 })
    }

    const format   = body.format || 'html'
    const safeName = (body.resumeData.name || 'resume').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')

    // ── HTML export ────────────────────────────────────────────────────────────
    if (format === 'html') {
      const html = renderFullHTML(body.templateId, body.resumeData)
      return new Response(html, {
        headers: {
          'Content-Type':        'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeName}.html"`,
          'Cache-Control':       'no-store',
        },
      })
    }

    // ── Plain text export ──────────────────────────────────────────────────────
    if (format === 'txt') {
      const txt = buildPlainText(body.resumeData)
      return new Response(txt, {
        headers: {
          'Content-Type':        'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeName}.txt"`,
          'Cache-Control':       'no-store',
        },
      })
    }

    // ── DOCX export ────────────────────────────────────────────────────────────
    if (format === 'docx') {
      const buffer = await buildDocx(body.resumeData)
      return new Response(buffer, {
        headers: {
          'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${safeName}.docx"`,
          'Cache-Control':       'no-store',
        },
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (err) {
    console.error('[POST /api/export]', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}

// ── Plain text builder ─────────────────────────────────────────────────────────
function buildPlainText(d: ResumeData): string {
  const lines: string[] = []
  const sep = '─'.repeat(60)

  lines.push(d.name || '')
  lines.push([d.email, d.phone, d.location].filter(Boolean).join(' | '))
  if (d.linkedin) lines.push(d.linkedin)
  lines.push('')

  if (d.summary) {
    lines.push('SUMMARY'); lines.push(sep); lines.push(d.summary); lines.push('')
  }

  if (d.experience?.length) {
    lines.push('EXPERIENCE'); lines.push(sep)
    for (const exp of d.experience) {
      lines.push(`${exp.title} — ${exp.company}${exp.location ? ', ' + exp.location : ''}`)
      lines.push(exp.dates || '')
      for (const b of (exp.bullets || [])) lines.push(`  • ${b.text}`)
      lines.push('')
    }
  }

  if (d.education?.length) {
    lines.push('EDUCATION'); lines.push(sep)
    for (const edu of d.education) {
      lines.push(`${edu.institution} — ${edu.degree}${edu.field ? ', ' + edu.field : ''}`)
      lines.push(edu.dates || '')
      lines.push('')
    }
  }

  if (d.skills?.categories?.length) {
    lines.push('SKILLS'); lines.push(sep)
    for (const cat of d.skills.categories) {
      lines.push(`${cat.name}: ${cat.items.join(', ')}`)
    }
    lines.push('')
  }

  if (d.projects?.length) {
    lines.push('PROJECTS'); lines.push(sep)
    for (const p of d.projects) {
      lines.push(`${p.name}${p.tech ? ' — ' + p.tech : ''}`)
      if (p.description) lines.push(p.description)
      for (const b of (p.bullets || [])) lines.push(`  • ${b.text}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ── DOCX builder ───────────────────────────────────────────────────────────────
async function buildDocx(d: ResumeData): Promise<ArrayBuffer> {
  const {
    Document, Paragraph, TextRun, HeadingLevel, AlignmentType,
    BorderStyle, Packer,
  } = await import('docx')

  const ACCENT = '2563EB'

  function heading(text: string) {
    return new Paragraph({
      text,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
    })
  }

  function bold(text: string, size = 22) {
    return new TextRun({ text, bold: true, size })
  }

  function normal(text: string, size = 20) {
    return new TextRun({ text, size })
  }

  function muted(text: string, size = 18) {
    return new TextRun({ text, size, color: '666666' })
  }

  const children: InstanceType<typeof Paragraph>[] = []

  // Name + contact
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: d.name || '', bold: true, size: 36 })],
  }))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [muted([d.email, d.phone, d.location, d.linkedin].filter(Boolean).join(' · '))],
  }))

  // Summary
  if (d.summary) {
    children.push(heading('Summary'))
    children.push(new Paragraph({ children: [normal(d.summary)], spacing: { after: 120 } }))
  }

  // Experience
  if (d.experience?.length) {
    children.push(heading('Experience'))
    for (const exp of d.experience) {
      children.push(new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [bold(exp.title), muted(`  ${exp.company}${exp.location ? ' · ' + exp.location : ''}`)],
      }))
      children.push(new Paragraph({ children: [muted(exp.dates || '', 18)], spacing: { after: 40 } }))
      for (const b of (exp.bullets || [])) {
        children.push(new Paragraph({
          children: [normal('• ' + b.text)],
          spacing: { after: 40 },
          indent: { left: 360 },
        }))
      }
    }
  }

  // Education
  if (d.education?.length) {
    children.push(heading('Education'))
    for (const edu of d.education) {
      children.push(new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [bold(edu.institution), muted(`  ${edu.degree}${edu.field ? ', ' + edu.field : ''}`)],
      }))
      children.push(new Paragraph({ children: [muted(edu.dates || '', 18)], spacing: { after: 80 } }))
    }
  }

  // Skills
  if (d.skills?.categories?.length) {
    children.push(heading('Skills'))
    for (const cat of d.skills.categories) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [bold(cat.name + ': ', 20), normal(cat.items.join(', '))],
      }))
    }
  }

  // Projects
  if (d.projects?.length) {
    children.push(heading('Projects'))
    for (const p of d.projects) {
      children.push(new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [bold(p.name), p.tech ? muted(' — ' + p.tech) : normal('')],
      }))
      if (p.description) {
        children.push(new Paragraph({ children: [normal(p.description)], spacing: { after: 40 } }))
      }
    }
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } },
      children,
    }],
  })

  const buf = await Packer.toBuffer(doc)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}
