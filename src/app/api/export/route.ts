// src/app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildResumePdf } from '@/lib/pdf/generate'
import type { ResumeData, TemplateId } from '@/types/resume'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      resumeData: ResumeData
      templateId: TemplateId
      format: 'pdf' | 'docx' | 'latex'
    }

    if (!body.resumeData || !body.templateId) {
      return NextResponse.json({ error: 'resumeData and templateId required' }, { status: 400 })
    }

    const format   = body.format || 'pdf'
    const safeName = (body.resumeData.name || 'resume').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')

    // ── PDF export ──────────────────────────────────────────────────────────────
    // Pure-JS layout via @react-pdf/renderer (src/lib/pdf/generate.tsx) — not a
    // browser screenshot of the HTML template, so it doesn't need a headless
    // Chromium binary that wouldn't run on a Windows dev machine anyway.
    if (format === 'pdf') {
      const pdf = await buildResumePdf(body.resumeData)
      return new Response(new Uint8Array(pdf), {
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
          'Cache-Control':       'no-store',
        },
      })
    }

    // ── LaTeX export ────────────────────────────────────────────────────────────
    if (format === 'latex') {
      const tex = buildLatex(body.resumeData)
      return new Response(tex, {
        headers: {
          'Content-Type':        'application/x-tex; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeName}.tex"`,
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

// ── LaTeX builder ────────────────────────────────────────────────────────────────
// Escapes LaTeX's special characters — without this, a resume bullet like
// "cut costs by 30% using R&D data" would fail to compile (% starts a comment,
// & is a table column separator). Order matters: backslash must be escaped
// before the replacements that introduce new literal backslashes.
function texEscape(s: string): string {
  if (!s) return ''
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

// Produces a self-contained .tex file that compiles with only geometry,
// enumitem and fontenc — all part of any standard TeX Live/MiKTeX install
// and Overleaf's default template, so it compiles with no extra setup.
function buildLatex(d: ResumeData): string {
  const t = texEscape
  const lines: string[] = []

  lines.push('\\documentclass[10pt,letterpaper]{article}')
  lines.push('\\usepackage[margin=0.75in]{geometry}')
  lines.push('\\usepackage{enumitem}')
  lines.push('\\usepackage[T1]{fontenc}')
  lines.push('\\pagestyle{empty}')
  lines.push('\\setlength{\\parindent}{0pt}')
  lines.push('\\newcommand{\\sectionhead}[1]{\\vspace{8pt}{\\large\\bfseries #1}\\\\[-4pt]\\hrule\\vspace{4pt}}')
  lines.push('')
  lines.push('\\begin{document}')
  lines.push('')

  lines.push(`{\\LARGE \\textbf{${t(d.name)}}}\\\\[2pt]`)
  const contact = [d.email, d.phone, d.location, d.linkedin].filter(Boolean).map(t).join(' \\quad|\\quad ')
  if (contact) lines.push(`${contact}\\\\`)
  lines.push('')

  if (d.summary) {
    lines.push('\\sectionhead{Summary}')
    lines.push(t(d.summary))
    lines.push('')
  }

  if (d.experience?.length) {
    lines.push('\\sectionhead{Experience}')
    for (const exp of d.experience) {
      lines.push(`\\textbf{${t(exp.title)}}${exp.company ? ' --- ' + t(exp.company) : ''} \\hfill ${t(exp.dates)}\\\\`)
      if (exp.location) lines.push(`\\textit{${t(exp.location)}}\\\\`)
      const bullets = exp.bullets || []
      if (bullets.length) {
        lines.push('\\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=2pt]')
        for (const b of bullets) lines.push(`  \\item ${t(b.text)}`)
        lines.push('\\end{itemize}')
      }
      lines.push('\\vspace{4pt}')
    }
  }

  if (d.education?.length) {
    lines.push('\\sectionhead{Education}')
    for (const edu of d.education) {
      const degreeLine = [edu.degree, edu.field].filter(Boolean).join(', ')
      lines.push(`\\textbf{${t(edu.institution)}}${degreeLine ? ' --- ' + t(degreeLine) : ''}${edu.gpa ? ' (GPA ' + t(edu.gpa) + ')' : ''} \\hfill ${t(edu.dates)}\\\\`)
    }
    lines.push('\\vspace{2pt}')
  }

  if (d.skills?.categories?.length) {
    lines.push('\\sectionhead{Skills}')
    for (const cat of d.skills.categories) {
      lines.push(`\\textbf{${t(cat.name)}:} ${t(cat.items.join(', '))}\\\\`)
    }
  }

  if (d.projects?.length) {
    lines.push('\\sectionhead{Projects}')
    for (const p of d.projects) {
      lines.push(`\\textbf{${t(p.name)}}${p.tech ? ' --- ' + t(p.tech) : ''}\\\\`)
      if (p.description) lines.push(`${t(p.description)}\\\\`)
      const bullets = p.bullets || []
      if (bullets.length) {
        lines.push('\\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=2pt]')
        for (const b of bullets) lines.push(`  \\item ${t(b.text)}`)
        lines.push('\\end{itemize}')
      }
      lines.push('\\vspace{4pt}')
    }
  }

  lines.push('')
  lines.push('\\end{document}')
  lines.push('')

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
