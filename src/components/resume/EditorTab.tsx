'use client'
import { useState, useCallback } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { callLLM } from '@/lib/llm/client'
import { REWRITE_PROMPT } from '@/lib/llm/prompts'
import { Button, SectionBlock, Label } from '@/components/ui/primitives'
import { cn, generateId } from '@/lib/utils'
import { Edit3, Sparkles, Check, X, Plus, Trash2, Loader2, Save } from 'lucide-react'
import type { ResumeData, Experience, Bullet } from '@/types/resume'

type Rewrites = Record<string, { rewritten: string; improvements: string[] }>

export function EditorTab({ resumeId }: { resumeId: string }) {
  const { resumeData, updateResumeField, byokCreds, loading, setLoading, addToast } = useResumeStore()
  const [rewrites, setRewrites]   = useState<Rewrites>({})
  const [saving, setSaving]       = useState(false)
  const [dirtyFields, setDirty]   = useState<Set<string>>(new Set())

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

  // ── Editable field ──────────────────────────────────────────────────────────
  function EditableField({
    id, value, multiline = false, placeholder = 'Click to edit…', context,
    onSave,
  }: {
    id: string; value: string; multiline?: boolean; placeholder?: string
    context: string; onSave: (val: string) => void
  }) {
    const [editing, setEditing] = useState(false)
    const [local, setLocal]     = useState(value)
    const rw = rewrites[id]
    const isRewriting = loading.rewriting === id

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
              <Button size="sm" className="ml-auto" onClick={() => requestRewrite(id, local, context)} disabled={isRewriting} loading={isRewriting}>
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
                <Button variant="success" size="sm" onClick={() => acceptRewrite(id, v => { onSave(v); setDirty(p => new Set(p).add(id)) })}>
                  <Check size={11} />Accept
                </Button>
                <Button size="sm" onClick={() => dismissRewrite(id)}><X size={11} />Dismiss</Button>
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

  if (!resumeData) return (
    <div className="p-6 text-center text-slate-500">Upload a resume to edit it.</div>
  )

  return (
    <div className="mx-auto px-6 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg">Resume Editor</h2>
          <p className="text-xs text-slate-500 mt-0.5">Click any field to edit · AI Rewrite available in edit mode</p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyFields.size > 0 && (
            <span className="text-xs text-amber-400 font-mono">{dirtyFields.size} unsaved change{dirtyFields.size > 1 ? 's' : ''}</span>
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
              <EditableField
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
        <EditableField
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
            <div className="grid grid-cols-2 gap-3 mb-3">
              {(['title', 'company', 'dates', 'location'] as const).map(f => (
                <div key={f}>
                  <Label>{f}</Label>
                  <EditableField
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
                  <EditableField
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
            <div className="grid grid-cols-2 gap-3">
              {(['institution', 'degree', 'field', 'dates', 'gpa'] as const).map(f => (
                <div key={f}>
                  <Label>{f}</Label>
                  <EditableField
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
      </SectionBlock>

      {/* Projects */}
      {(resumeData.projects?.length ?? 0) > 0 && (
        <SectionBlock title={`Projects (${resumeData.projects?.length ?? 0})`} icon={<Edit3 size={13} className="text-slate-500" />}>
          {resumeData.projects?.map((proj, pi) => (
            <div key={proj.id || pi} className="mb-4 pb-4 border-b border-white/7 last:border-none last:mb-0 last:pb-0">
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <Label>Name</Label>
                  <EditableField id={`proj_${pi}_name`} value={proj.name} context="Project" onSave={v => updateResumeField(p => { const projects = [...p.projects]; projects[pi] = { ...projects[pi], name: v }; return { ...p, projects } })} />
                </div>
                <div>
                  <Label>Tech Stack</Label>
                  <EditableField id={`proj_${pi}_tech`} value={proj.tech} context="Tech stack" onSave={v => updateResumeField(p => { const projects = [...p.projects]; projects[pi] = { ...projects[pi], tech: v }; return { ...p, projects } })} />
                </div>
              </div>
              <Label>Description</Label>
              <EditableField id={`proj_${pi}_desc`} value={proj.description} multiline context="Project description" onSave={v => updateResumeField(p => { const projects = [...p.projects]; projects[pi] = { ...projects[pi], description: v }; return { ...p, projects } })} />
            </div>
          ))}
        </SectionBlock>
      )}
    </div>
  )
}
