// src/components/resume/EditorTab.tsx
'use client'
import { useState, useEffect } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { callLLM } from '@/lib/llm/client'
import { REWRITE_PROMPT } from '@/lib/llm/prompts'
import { Button, SectionBlock, Label } from '@/components/ui/primitives'
import { cn, generateId } from '@/lib/utils'
import { Edit3, Sparkles, Check, X, Plus, Trash2, Save, Undo2, Redo2, Download } from 'lucide-react'

type Rewrites = Record<string, { rewritten: string; improvements: string[] }>

// Cross-cutting state/handlers EditableField needs from EditorTab, bundled into
// one prop so every call site only has to pass one extra prop instead of six.
interface EditableFieldShared {
  rewrites: Rewrites
  rewritingId: string | null
  dirtyFields: Set<string>
  setDirty: (updater: (prev: Set<string>) => Set<string>) => void
  onRequestRewrite: (id: string, text: string, context: string) => void
  onAcceptRewrite: (id: string, applyFn: (val: string) => void) => void
  onDismissRewrite: (id: string) => void
}

// Hoisted to module scope — defining this inside EditorTab's render body would
// recreate it (and reset its internal edit/local state) on every render. See
// react-hooks/static-components.
function EditableField({
  id, value, multiline = false, placeholder = 'Click to edit…', context,
  onSave, shared,
}: {
  id: string; value: string; multiline?: boolean; placeholder?: string
  context: string; onSave: (val: string) => void
  shared: EditableFieldShared
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal]     = useState(value)
  const { rewrites, rewritingId, dirtyFields, setDirty, onRequestRewrite, onAcceptRewrite, onDismissRewrite } = shared
  const rw = rewrites[id]
  const isRewriting = rewritingId === id

  function save() {
    onSave(local)
    setDirty(p => new Set(p).add(id))
    setEditing(false)
  }

  return (
    <div>
      {editing ? (
        <div className="space-y-2">
          {multiline ? (
            <textarea
              rows={4} value={local} onChange={e => setLocal(e.target.value)} autoFocus
              className="w-full bg-[#1c1c24] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 resize-none"
            />
          ) : (
            <input
              value={local} onChange={e => setLocal(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && save()}
              className="w-full bg-[#1c1c24] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50"
            />
          )}
          <div className="flex gap-2">
            <Button variant="success" size="sm" onClick={save}><Check size={12} />Save</Button>
            <Button size="sm" onClick={() => setEditing(false)}><X size={12} />Cancel</Button>
            <Button size="sm" className="ml-auto" onClick={() => onRequestRewrite(id, local, context)} disabled={isRewriting} loading={isRewriting}>
              <Sparkles size={12} />AI Rewrite
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => { setLocal(value); setEditing(true) }}
          className={cn(
            'group relative cursor-pointer px-3 py-2 rounded-lg text-sm transition-colors min-h-[36px]',
            'bg-[#1c1c24] border border-white/7 hover:border-white/15',
            dirtyFields.has(id) && 'border-violet-500/30',
          )}
        >
          <span className={value ? 'text-slate-200' : 'text-slate-600'}>{value || placeholder}</span>
          <Edit3 size={11} className="absolute right-2 top-2 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* AI rewrite preview */}
      {rw && (
        <div className="mt-2 border border-violet-500/25 rounded-lg overflow-hidden">
          <div className="bg-violet-500/8 px-3 py-1.5 flex items-center justify-between">
            <span className="text-xs font-mono text-violet-400">✦ AI Rewrite</span>
            <div className="flex gap-1.5">
              <Button variant="success" size="sm" onClick={() => onAcceptRewrite(id, v => { onSave(v); setDirty(p => new Set(p).add(id)) })}>
                <Check size={11} />Accept
              </Button>
              <Button size="sm" onClick={() => onDismissRewrite(id)}><X size={11} />Dismiss</Button>
            </div>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            <div className="flex items-start gap-2 text-xs">
              <span className="text-red-400 line-through opacity-60 flex-1 leading-relaxed">{value}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="text-emerald-400 flex-1 leading-relaxed">{rw.rewritten}</span>
            </div>
            {rw.improvements?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {rw.improvements.map((imp, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-white/5 text-slate-400 rounded-full">{imp}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function EditorTab({ resumeId }: { resumeId: string }) {
  const {
    resumeData, updateResumeField, byokCreds, loading, setLoading, addToast,
    undo, redo, undoPast, undoFuture, selectedTemplate,
  } = useResumeStore()
  const [rewrites, setRewrites]     = useState<Rewrites>({})
  const [saving, setSaving]         = useState(false)
  const [dirtyFields, setDirty]     = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  // Quick PDF download, shown only once something's actually been edited —
  // same mechanism as the Score tab's post-fix download button.
  async function quickDownload() {
    if (!resumeData) return
    setDownloading(true)
    try {
      const res = await fetch('/api/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData, templateId: selectedTemplate, format: 'pdf' }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${(resumeData.name || 'resume').replace(/\s+/g, '_')}.pdf`; a.click()
      URL.revokeObjectURL(url)
      addToast('PDF downloaded', 'success')
    } catch {
      addToast('Download failed', 'error')
    }
    setDownloading(false)
  }

  // Keyboard shortcuts — Cmd/Ctrl+Z for undo, Cmd/Ctrl+Shift+Z for redo
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return
      // Don't intercept while typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        addToast('Undo', 'info', 1500)
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        redo()
        addToast('Redo', 'info', 1500)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, addToast])

  // ── Save to DB ─────────────────────────────────────────────────────────────
  async function saveToDb() {
    // Auto-snapshot before saving so history is always up to date
    if (resumeData) {
      fetch(`/api/resume/${resumeId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedData: resumeData, label: `Auto-save — ${new Date().toLocaleString()}` }),
      }).catch(() => {}) // non-blocking
    }
    if (!resumeData) return
    setSaving(true)
    try {
      const res = await fetch(`/api/resume/${resumeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedData: resumeData }),
      })
      if (!res.ok) throw new Error('Save failed')
      setDirty(new Set())
      addToast('Saved ✓', 'success')
    } catch {
      addToast('Save failed — try again', 'error')
    }
    setSaving(false)
  }

  // ── AI Rewrite ──────────────────────────────────────────────────────────────
  async function requestRewrite(fieldId: string, text: string, context: string) {
    if (!byokCreds.apiKey) { addToast('Add API key first', 'error'); return }
    setLoading('rewriting', fieldId)
    try {
      const res = await callLLM<{ rewritten: string; improvements: string[] }>({
        creds: byokCreds,
        systemPrompt: REWRITE_PROMPT,
        userPrompt: `Section context: ${context}\nCurrent text: "${text}"`,
      })
      setRewrites(p => ({ ...p, [fieldId]: res }))
      addToast('AI rewrite ready — review below', 'info')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Rewrite failed', 'error')
    }
    setLoading('rewriting', null)
  }

  function acceptRewrite(fieldId: string, applyFn: (val: string) => void) {
    const rw = rewrites[fieldId]
    if (!rw) return
    applyFn(rw.rewritten)
    setRewrites(p => { const n = { ...p }; delete n[fieldId]; return n })
    addToast('Rewrite applied ✓', 'success')
  }

  function dismissRewrite(fieldId: string) {
    setRewrites(p => { const n = { ...p }; delete n[fieldId]; return n })
  }

  if (!resumeData) return (
    <div className="p-6 text-center text-slate-500">Upload a resume to edit it.</div>
  )

  const editableShared: EditableFieldShared = {
    rewrites, rewritingId: loading.rewriting, dirtyFields, setDirty,
    onRequestRewrite: requestRewrite, onAcceptRewrite: acceptRewrite, onDismissRewrite: dismissRewrite,
  }

  return (
    <div className="mx-auto px-6 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg">Resume Editor</h2>
          <p className="text-xs text-slate-500 mt-0.5">Click any field to edit · AI Rewrite available in edit mode</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <button
            onClick={() => { undo(); addToast('Undo', 'info', 1500) }}
            disabled={undoPast.length === 0}
            title="Undo (Ctrl+Z)"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/7 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={() => { redo(); addToast('Redo', 'info', 1500) }}
            disabled={undoFuture.length === 0}
            title="Redo (Ctrl+Shift+Z)"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/7 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 size={14} />
          </button>
          <div className="w-px h-4 bg-white/10" />
          {dirtyFields.size > 0 && (
            <>
              <span className="text-xs text-amber-400 font-mono">{dirtyFields.size} unsaved change{dirtyFields.size > 1 ? 's' : ''}</span>
              <Button size="sm" onClick={quickDownload} loading={downloading}>
                <Download size={13} />Download PDF
              </Button>
            </>
          )}
          <Button variant="primary" size="sm" onClick={saveToDb} loading={saving}>
            <Save size={13} />Save All
          </Button>
        </div>
      </div>

      {/* Contact */}
      <SectionBlock title="Contact Info" icon={<Edit3 size={13} className="text-slate-500" />}>
        <div className="grid grid-cols-2 gap-3">
          {(['name','email','phone','location','linkedin','github','website'] as const).map(f => (
            <div key={f}>
              <Label>{f}</Label>
              <EditableField shared={editableShared}
                id={`contact_${f}`}
                value={(resumeData as unknown as Record<string, string>)[f] || ''}
                placeholder={f}
                context="Contact information"
                onSave={v => updateResumeField(p => ({ ...p, [f]: v }))}
              />
            </div>
          ))}
        </div>
      </SectionBlock>

      {/* Summary */}
      <SectionBlock title="Professional Summary" icon={<Edit3 size={13} className="text-slate-500" />}>
        <EditableField shared={editableShared}
          id="summary"
          value={resumeData.summary || ''}
          multiline
          placeholder="Write a compelling professional summary…"
          context="Professional summary / objective statement"
          onSave={v => updateResumeField(p => ({ ...p, summary: v }))}
        />
      </SectionBlock>

      {/* Experience */}
      <SectionBlock title={`Experience (${resumeData.experience?.length ?? 0})`} icon={<Edit3 size={13} className="text-slate-500" />}>
        {resumeData.experience?.map((exp, ei) => (
          <div key={exp.id || ei} className="mb-6 pb-6 border-b border-white/7 last:border-none last:mb-0 last:pb-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-500">
                {exp.title || exp.company ? `${exp.title || 'Untitled role'}${exp.company ? ` · ${exp.company}` : ''}` : `Entry ${ei + 1}`}
              </span>
              <button
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-400 transition-colors"
                onClick={() => {
                  if (!confirm('Remove this entire experience entry? This cannot be undone after saving.')) return
                  updateResumeField(p => ({ ...p, experience: p.experience.filter((_, i) => i !== ei) }))
                  addToast('Experience entry removed', 'info')
                }}
              >
                <Trash2 size={11} />Remove entry
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {(['title', 'company', 'dates', 'location'] as const).map(f => (
                <div key={f}>
                  <Label>{f}</Label>
                  <EditableField shared={editableShared}
                    id={`exp_${ei}_${f}`}
                    value={exp[f] || ''}
                    context={`Work experience at ${exp.company}`}
                    onSave={v => updateResumeField(p => {
                      const experience = [...p.experience]
                      experience[ei] = { ...experience[ei], [f]: v }
                      return { ...p, experience }
                    })}
                  />
                </div>
              ))}
            </div>
            <Label>Bullet Points</Label>
            {exp.bullets?.map((bul, bi) => (
              <div key={bul.id || bi} className="flex gap-2 items-start mb-2">
                <span className="text-slate-500 mt-2.5 shrink-0 text-xs">•</span>
                <div className="flex-1">
                  <EditableField shared={editableShared}
                    id={`exp_${ei}_bul_${bi}`}
                    value={bul.text}
                    multiline
                    context={`Resume bullet for ${exp.title} at ${exp.company}`}
                    onSave={v => updateResumeField(p => {
                      const experience = [...p.experience]
                      const bullets = [...(experience[ei].bullets || [])]
                      bullets[bi] = { ...bullets[bi], text: v }
                      experience[ei] = { ...experience[ei], bullets }
                      return { ...p, experience }
                    })}
                  />
                </div>
                <button
                  className="mt-2 text-slate-600 hover:text-red-400 transition-colors"
                  onClick={() => updateResumeField(p => {
                    const experience = [...p.experience]
                    experience[ei] = { ...experience[ei], bullets: experience[ei].bullets.filter((_, i) => i !== bi) }
                    return { ...p, experience }
                  })}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-400 transition-colors mt-1"
              onClick={() => updateResumeField(p => {
                const experience = [...p.experience]
                experience[ei] = { ...experience[ei], bullets: [...(experience[ei].bullets || []), { id: generateId('bul'), text: '' }] }
                return { ...p, experience }
              })}
            >
              <Plus size={11} />Add bullet
            </button>
          </div>
        ))}
        <button
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors mt-2"
          onClick={() => updateResumeField(p => ({
            ...p,
            experience: [...p.experience, {
              id: generateId('exp'), company: '', title: '', location: '', dates: '', bullets: []
            }]
          }))}
        >
          <Plus size={12} />Add experience
        </button>
      </SectionBlock>

      {/* Skills */}
      <SectionBlock title="Skills" icon={<Edit3 size={13} className="text-slate-500" />}>
        {resumeData.skills?.categories?.map((cat, ci) => (
          <div key={ci} className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <input
                value={cat.name}
                onChange={e => updateResumeField(p => {
                  const categories = [...(p.skills?.categories || [])]
                  categories[ci] = { ...categories[ci], name: e.target.value }
                  return { ...p, skills: { ...p.skills, categories } }
                })}
                placeholder="Category (e.g. Languages)"
                className="w-40 bg-[#1c1c24] border border-white/8 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
              />
              <button
                className="text-slate-600 hover:text-red-400 transition-colors"
                onClick={() => updateResumeField(p => ({
                  ...p, skills: { ...p.skills, categories: (p.skills?.categories || []).filter((_, i) => i !== ci) }
                }))}
              >
                <Trash2 size={11} />
              </button>
            </div>
            <input
              value={(cat.items || []).join(', ')}
              onChange={e => updateResumeField(p => {
                const categories = [...(p.skills?.categories || [])]
                categories[ci] = { ...categories[ci], items: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                return { ...p, skills: { ...p.skills, categories } }
              })}
              placeholder="skill1, skill2, skill3"
              className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50"
            />
          </div>
        ))}
        <button
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors mt-1"
          onClick={() => updateResumeField(p => ({
            ...p, skills: { ...p.skills, categories: [...(p.skills?.categories || []), { name: '', items: [] }] }
          }))}
        >
          <Plus size={12} />Add category
        </button>
      </SectionBlock>

      {/* Education */}
      <SectionBlock title="Education" icon={<Edit3 size={13} className="text-slate-500" />}>
        {resumeData.education?.map((edu, ei) => (
          <div key={edu.id || ei} className="mb-4 pb-4 border-b border-white/7 last:border-none last:mb-0 last:pb-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-500">
                {edu.institution || edu.degree ? `${edu.institution || 'Untitled'}${edu.degree ? ` · ${edu.degree}` : ''}` : `Entry ${ei + 1}`}
              </span>
              <button
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-400 transition-colors"
                onClick={() => {
                  if (!confirm('Remove this entire education entry? This cannot be undone after saving.')) return
                  updateResumeField(p => ({ ...p, education: p.education.filter((_, i) => i !== ei) }))
                  addToast('Education entry removed', 'info')
                }}
              >
                <Trash2 size={11} />Remove entry
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['institution', 'degree', 'field', 'dates', 'gpa'] as const).map(f => (
                <div key={f}>
                  <Label>{f}</Label>
                  <EditableField shared={editableShared}
                    id={`edu_${ei}_${f}`}
                    value={edu[f] || ''}
                    context="Education"
                    onSave={v => updateResumeField(p => {
                      const education = [...p.education]
                      education[ei] = { ...education[ei], [f]: v }
                      return { ...p, education }
                    })}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors mt-2"
          onClick={() => updateResumeField(p => ({
            ...p,
            education: [...(p.education || []), {
              id: generateId('edu'), institution: '', degree: '', field: '', dates: '', gpa: '', notes: ''
            }]
          }))}
        >
          <Plus size={12} />Add education
        </button>
      </SectionBlock>
      <SectionBlock title={`Projects (${resumeData.projects?.length ?? 0})`} icon={<Edit3 size={13} className="text-slate-500" />}>
        {resumeData.projects?.map((proj, pi) => (
          <div key={proj.id || pi} className="mb-4 pb-4 border-b border-white/7 last:border-none last:mb-0 last:pb-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-500">{proj.name || `Project ${pi + 1}`}</span>
              <button
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-400 transition-colors"
                onClick={() => {
                  if (!confirm('Remove this entire project? This cannot be undone after saving.')) return
                  updateResumeField(p => ({ ...p, projects: p.projects.filter((_, i) => i !== pi) }))
                  addToast('Project removed', 'info')
                }}
              >
                <Trash2 size={11} />Remove project
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <Label>Name</Label>
                <EditableField shared={editableShared} id={`proj_${pi}_name`} value={proj.name} context="Project" onSave={v => updateResumeField(p => { const projects = [...p.projects]; projects[pi] = { ...projects[pi], name: v }; return { ...p, projects } })} />
              </div>
              <div>
                <Label>Tech Stack</Label>
                <EditableField shared={editableShared} id={`proj_${pi}_tech`} value={proj.tech} context="Tech stack" onSave={v => updateResumeField(p => { const projects = [...p.projects]; projects[pi] = { ...projects[pi], tech: v }; return { ...p, projects } })} />
              </div>
            </div>
            <Label>Description</Label>
            <EditableField shared={editableShared} id={`proj_${pi}_desc`} value={proj.description} multiline context="Project description" onSave={v => updateResumeField(p => { const projects = [...p.projects]; projects[pi] = { ...projects[pi], description: v }; return { ...p, projects } })} />
          </div>
        ))}
        <button
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors mt-2"
          onClick={() => updateResumeField(p => ({
            ...p,
            projects: [...(p.projects || []), {
              id: generateId('proj'), name: '', description: '', bullets: [], tech: ''
            }]
          }))}
        >
          <Plus size={12} />Add project
        </button>
      </SectionBlock>
    </div>
  )
}
