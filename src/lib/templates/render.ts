import type { ResumeData, TemplateId, Template } from '@/types/resume'

export const TEMPLATES: Record<TemplateId, Template> = {
  classic:   { id: 'classic',   name: 'Classic',   description: 'Clean traditional format — maximally ATS-safe',       accentColor: '#2563eb' },
  modern:    { id: 'modern',    name: 'Modern',     description: 'Two-column layout with accent sidebar',               accentColor: '#7c3aed' },
  minimal:   { id: 'minimal',   name: 'Minimal',    description: 'Ultra-clean, typography-focused',                     accentColor: '#059669' },
  executive: { id: 'executive', name: 'Executive',  description: 'Bold header, strong section hierarchy',               accentColor: '#b45309' },
}

function esc(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bullets(items: Array<{ text: string }> | undefined): string {
  if (!items?.length) return ''
  return `<ul style="margin:4px 0 0 0;padding-left:18px">${items.map(b => `<li style="margin-bottom:3px">${esc(b.text)}</li>`).join('')}</ul>`
}

export function renderTemplate(templateId: TemplateId, data: ResumeData): string {
  switch (templateId) {
    case 'classic':   return renderClassic(data)
    case 'modern':    return renderModern(data)
    case 'minimal':   return renderMinimal(data)
    case 'executive': return renderExecutive(data)
  }
}

export function renderFullHTML(templateId: TemplateId, data: ResumeData): string {
  const body = renderTemplate(templateId, data)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(data.name)} — Resume</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; padding: 32px; }
  ul { padding-left: 18px; }
  li { margin-bottom: 3px; }
  @media print {
    body { padding: 0; }
    @page { margin: 24px; }
  }
</style>
</head>
<body>${body}</body>
</html>`
}

// ─── Classic ──────────────────────────────────────────────────────────────────
function renderClassic(d: ResumeData): string {
  const skills = d.skills?.categories?.map(c =>
    `<div style="margin-bottom:4px"><strong>${esc(c.name)}:</strong> ${c.items?.join(', ')}</div>`
  ).join('') || ''

  return `<div style="font-family:Georgia,serif;font-size:13px;line-height:1.6;color:#111;max-width:680px;margin:0 auto">
  <div style="text-align:center;margin-bottom:16px;border-bottom:2px solid #111;padding-bottom:12px">
    <h1 style="font-size:24px;margin-bottom:4px;font-family:Arial,sans-serif;letter-spacing:-.01em">${esc(d.name)}</h1>
    <p style="font-size:12px;color:#555">${[d.email,d.phone,d.location,d.linkedin].filter(Boolean).map(esc).join(' · ')}</p>
  </div>
  ${d.summary ? `<div style="margin-bottom:14px"><h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:6px">Summary</h2><p>${esc(d.summary)}</p></div>` : ''}
  ${d.experience?.length ? `<div style="margin-bottom:14px"><h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:8px">Experience</h2>${d.experience.map(e => `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong>${esc(e.title)}</strong><span style="font-size:11px;color:#555">${esc(e.dates)}</span></div><div style="font-size:12px;color:#444;margin-bottom:3px">${esc(e.company)}${e.location ? ' · ' + esc(e.location) : ''}</div>${bullets(e.bullets)}</div>`).join('')}</div>` : ''}
  ${d.projects?.length ? `<div style="margin-bottom:14px"><h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:8px">Projects</h2>${d.projects.map(p => `<div style="margin-bottom:10px"><div><strong>${esc(p.name)}</strong>${p.tech ? ` <span style="font-size:11px;color:#666">— ${esc(p.tech)}</span>` : ''}</div><div style="font-size:12px">${esc(p.description)}</div>${bullets(p.bullets)}</div>`).join('')}</div>` : ''}
  ${d.education?.length ? `<div style="margin-bottom:14px"><h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:8px">Education</h2>${d.education.map(e => `<div style="display:flex;justify-content:space-between;margin-bottom:6px"><div><strong>${esc(e.institution)}</strong><div style="font-size:12px;color:#444">${esc(e.degree)}${e.field ? ' in ' + esc(e.field) : ''}${e.gpa ? ' · GPA: ' + esc(e.gpa) : ''}</div></div><span style="font-size:11px;color:#555">${esc(e.dates)}</span></div>`).join('')}</div>` : ''}
  ${skills ? `<div><h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:8px">Skills</h2>${skills}</div>` : ''}
</div>`
}

// ─── Modern ───────────────────────────────────────────────────────────────────
function renderModern(d: ResumeData): string {
  const skills = d.skills?.categories?.map(c =>
    `<div style="margin-bottom:8px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7c3aed;font-weight:600;margin-bottom:2px">${esc(c.name)}</div><div style="font-size:11.5px">${c.items?.join(', ')}</div></div>`
  ).join('') || ''

  return `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#111;display:grid;grid-template-columns:200px 1fr;gap:0;max-width:700px;margin:0 auto">
  <div style="background:#f3f0ff;padding:24px 16px;font-size:12px">
    <div style="margin-bottom:20px">
      <h1 style="font-size:18px;font-weight:800;color:#1a1a2e;line-height:1.2;margin-bottom:8px">${esc(d.name)}</h1>
      ${d.email ? `<div style="color:#555;font-size:11px;margin-bottom:2px">✉ ${esc(d.email)}</div>` : ''}
      ${d.phone ? `<div style="color:#555;font-size:11px;margin-bottom:2px">☎ ${esc(d.phone)}</div>` : ''}
      ${d.location ? `<div style="color:#555;font-size:11px;margin-bottom:2px">⌂ ${esc(d.location)}</div>` : ''}
      ${d.linkedin ? `<div style="color:#7c3aed;font-size:11px;margin-bottom:2px">in ${esc(d.linkedin)}</div>` : ''}
      ${d.github ? `<div style="color:#7c3aed;font-size:11px;margin-bottom:2px">⌥ ${esc(d.github)}</div>` : ''}
    </div>
    ${skills ? `<div style="border-top:1px solid #ddd5ff;padding-top:14px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:#7c3aed;margin-bottom:8px">Skills</div>${skills}</div>` : ''}
    ${d.education?.length ? `<div style="border-top:1px solid #ddd5ff;padding-top:14px;margin-top:14px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:#7c3aed;margin-bottom:8px">Education</div>${d.education.map(e => `<div style="margin-bottom:8px"><strong style="font-size:11.5px">${esc(e.institution)}</strong><div style="font-size:11px;color:#444">${esc(e.degree)}</div><div style="font-size:10.5px;color:#666">${esc(e.dates)}</div></div>`).join('')}</div>` : ''}
    ${d.certifications?.length ? `<div style="border-top:1px solid #ddd5ff;padding-top:14px;margin-top:14px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:#7c3aed;margin-bottom:8px">Certifications</div>${d.certifications.map(c => `<div style="margin-bottom:6px;font-size:11.5px"><strong>${esc(c.name)}</strong><div style="font-size:11px;color:#666">${esc(c.issuer)}</div></div>`).join('')}</div>` : ''}
  </div>
  <div style="padding:24px 20px">
    ${d.summary ? `<p style="font-size:12.5px;color:#333;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #eee;font-style:italic">${esc(d.summary)}</p>` : ''}
    ${d.experience?.length ? `<div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:#7c3aed;margin-bottom:10px">Experience</div>${d.experience.map(e => `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:13px">${esc(e.title)}</strong><span style="font-size:10.5px;color:#777;background:#f3f0ff;padding:1px 6px;border-radius:4px">${esc(e.dates)}</span></div><div style="font-size:11.5px;color:#7c3aed;margin-bottom:4px">${esc(e.company)}</div>${bullets(e.bullets)}</div>`).join('')}` : ''}
    ${d.projects?.length ? `<div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:#7c3aed;margin:14px 0 10px">Projects</div>${d.projects.map(p => `<div style="margin-bottom:10px"><strong>${esc(p.name)}</strong>${p.tech ? `<span style="font-size:10.5px;color:#888;margin-left:6px">${esc(p.tech)}</span>` : ''}<div style="font-size:12px">${esc(p.description)}</div></div>`).join('')}` : ''}
  </div>
</div>`
}

// ─── Minimal ──────────────────────────────────────────────────────────────────
function renderMinimal(d: ResumeData): string {
  const allSkills = d.skills?.categories?.flatMap(c => c.items || []).join(' · ') || ''
  return `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.7;color:#1a1a1a;max-width:660px;margin:0 auto">
  <div style="border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px">
    <h1 style="font-size:30px;font-weight:300;letter-spacing:-.02em;margin-bottom:4px">${esc(d.name)}</h1>
    <p style="font-size:12px;color:#666">${[d.email,d.phone,d.location].filter(Boolean).map(esc).join('  ·  ')}</p>
  </div>
  ${d.summary ? `<p style="font-size:13px;color:#333;margin-bottom:22px;font-style:italic;padding-left:12px;border-left:2px solid #ddd">${esc(d.summary)}</p>` : ''}
  ${d.experience?.map(e => `<div style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px"><span><strong>${esc(e.title)}</strong>, ${esc(e.company)}</span><span style="font-size:11px;color:#888">${esc(e.dates)}</span></div>${bullets(e.bullets)}</div>`).join('') || ''}
  ${allSkills ? `<div style="border-top:1px solid #ddd;padding-top:14px;margin-top:4px;font-size:12.5px"><span style="font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-right:8px">Skills</span>${allSkills}</div>` : ''}
  ${d.education?.length ? `<div style="border-top:1px solid #ddd;padding-top:14px;margin-top:14px">${d.education.map(e => `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span><strong>${esc(e.institution)}</strong> · ${esc(e.degree)}${e.field ? ', ' + esc(e.field) : ''}</span><span style="font-size:11px;color:#888">${esc(e.dates)}</span></div>`).join('')}</div>` : ''}
</div>`
}

// ─── Executive ────────────────────────────────────────────────────────────────
function renderExecutive(d: ResumeData): string {
  const skills = d.skills?.categories?.map(c =>
    `<span style="background:#fef3c7;padding:2px 8px;border-radius:4px;font-size:11px;margin:2px;display:inline-block;color:#92400e">${c.items?.join(', ')}</span>`
  ).join('') || ''

  return `<div style="font-family:Georgia,serif;font-size:13px;line-height:1.6;color:#1a1a1a;max-width:680px;margin:0 auto">
  <div style="background:#1a1a2e;color:#fff;padding:24px 28px;margin-bottom:20px">
    <h1 style="font-size:26px;font-weight:700;font-family:Arial,sans-serif;letter-spacing:-.01em;margin-bottom:6px">${esc(d.name)}</h1>
    <p style="font-size:12px;color:#aab">${[d.email,d.phone,d.location,d.linkedin].filter(Boolean).map(esc).join(' | ')}</p>
  </div>
  ${d.summary ? `<div style="padding:0 4px;margin-bottom:18px"><p style="font-size:13px;color:#333;border-left:3px solid #b45309;padding-left:12px">${esc(d.summary)}</p></div>` : ''}
  ${d.experience?.length ? `<div style="padding:0 4px;margin-bottom:16px"><h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#b45309;font-weight:700;margin-bottom:10px">Professional Experience</h2>${d.experience.map(e => `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="font-size:14px">${esc(e.title)}</strong><em style="font-size:11px;color:#777">${esc(e.dates)}</em></div><div style="font-size:12.5px;color:#b45309;margin-bottom:4px">${esc(e.company)}${e.location ? ' · ' + esc(e.location) : ''}</div>${bullets(e.bullets)}</div>`).join('')}</div>` : ''}
  ${skills ? `<div style="padding:0 4px;margin-bottom:16px"><h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#b45309;font-weight:700;margin-bottom:8px">Core Competencies</h2><div>${skills}</div></div>` : ''}
  ${d.education?.length ? `<div style="padding:0 4px;margin-bottom:16px"><h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#b45309;font-weight:700;margin-bottom:8px">Education</h2>${d.education.map(e => `<div style="margin-bottom:6px"><strong>${esc(e.institution)}</strong><span style="color:#666;font-size:12px"> — ${esc(e.degree)}${e.field ? ', ' + esc(e.field) : ''}</span> <span style="float:right;font-size:11px;color:#888">${esc(e.dates)}</span></div>`).join('')}</div>` : ''}
  ${d.projects?.length ? `<div style="padding:0 4px"><h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#b45309;font-weight:700;margin-bottom:8px">Key Projects</h2>${d.projects.map(p => `<div style="margin-bottom:8px"><strong>${esc(p.name)}</strong>${p.tech ? ` <span style="font-size:11px;color:#888">— ${esc(p.tech)}</span>` : ''}<div style="font-size:12px">${esc(p.description)}</div></div>`).join('')}</div>` : ''}
</div>`
}
