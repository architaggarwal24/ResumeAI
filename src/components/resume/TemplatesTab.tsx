// src/components/resume/TemplatesTab.tsx
'use client'
import { useState } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { TEMPLATES, renderTemplate } from '@/lib/templates/render'
import { Card } from '@/components/ui/primitives'
import { Check, FileText, FileCode2, FileType } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TemplateId } from '@/types/resume'

type ExportFormat = 'pdf' | 'docx' | 'latex'

const FORMAT_CONFIG: { id: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'pdf',   label: 'PDF',         icon: <FileType  size={13}/>, desc: 'Ready to submit — opens anywhere, print-perfect' },
  { id: 'docx',  label: 'Word (.docx)',icon: <FileText  size={13}/>, desc: 'Edit in Microsoft Word or Google Docs' },
  { id: 'latex', label: 'LaTeX',       icon: <FileCode2 size={13}/>, desc: 'A .tex source file — edit and compile with any LaTeX tool' },
]

export function TemplatesTab({ resumeId }: { resumeId: string }) {
  const { resumeData, selectedTemplate, setSelectedTemplate, addToast } = useResumeStore()
  const [exporting, setExporting]     = useState<ExportFormat | null>(null)

  async function saveTemplate(id: TemplateId) {
    setSelectedTemplate(id)
    await fetch(`/api/resume/${resumeId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: id }),
    })
    addToast(`${TEMPLATES[id].name} template applied`, 'success')
  }

  async function exportResume(format: ExportFormat) {
    if (!resumeData) return
    setExporting(format)
    try {
      const res = await fetch('/api/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData, templateId: selectedTemplate, format }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob      = await res.blob()
      const url       = URL.createObjectURL(blob)
      const ext       = format === 'docx' ? 'docx' : format === 'latex' ? 'tex' : 'pdf'
      const filename  = `${(resumeData.name || 'resume').replace(/\s+/g, '_')}.${ext}`
      const a         = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      const hints: Record<ExportFormat, string> = {
        pdf:   'PDF downloaded — ready to submit as-is',
        docx:  'Opened in Word or Google Docs — ready to edit',
        latex: 'Compile the .tex file with any LaTeX distribution, or upload it to Overleaf',
      }
      addToast(hints[format], 'success', 6000)
    } catch {
      addToast('Export failed', 'error')
    }
    setExporting(null)
  }

  return (
    <div className="mx-auto px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg">Templates</h2>
          <p className="text-xs text-slate-500 mt-0.5">Content stays the same — only the layout changes</p>
        </div>
      </div>

      {/* Export formats */}
      <Card className="mb-8">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Export</p>
        <div className="grid grid-cols-3 gap-3">
          {FORMAT_CONFIG.map(fmt => (
            <button key={fmt.id} onClick={() => exportResume(fmt.id)} disabled={!resumeData || !!exporting}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all text-left disabled:opacity-50 group">
              <div className="w-8 h-8 rounded-lg bg-violet-600/15 flex items-center justify-center shrink-0 text-violet-400 group-hover:bg-violet-600/25 transition-colors">
                {exporting === fmt.id
                  ? <span className="text-xs font-mono text-violet-400 animate-pulse">…</span>
                  : fmt.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{fmt.label}</p>
                <p className="text-xs text-slate-500">{fmt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Template grid */}
      <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-4">Layout</p>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {(Object.values(TEMPLATES) as typeof TEMPLATES[TemplateId][]).map(t => (
          <div key={t.id}
            className={cn('border-2 rounded-xl overflow-hidden cursor-pointer transition-all',
              selectedTemplate === t.id
                ? 'border-violet-500 shadow-lg shadow-violet-900/30'
                : 'border-white/8 hover:border-white/20')}
            onClick={() => saveTemplate(t.id)}>
            <div className="bg-white aspect-[0.77] overflow-hidden relative">
              {resumeData ? (
                <div style={{ transform:'scale(0.28)', transformOrigin:'top left', width:'357%', height:'357%', pointerEvents:'none' }}
                  dangerouslySetInnerHTML={{ __html: renderTemplate(t.id, resumeData) }} />
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50 text-gray-400 text-xs">No preview</div>
              )}
              {selectedTemplate === t.id && (
                <div className="absolute inset-0 bg-violet-500/10 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shadow-lg">
                    <Check size={16} className="text-white" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 bg-[#16161d]">
              <div className="flex items-center justify-between mb-0.5">
                <p className="font-semibold text-sm">{t.name}</p>
                {selectedTemplate === t.id && <span className="text-xs font-mono text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">Active</span>}
              </div>
              <p className="text-xs text-slate-500 leading-snug">{t.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Live preview */}
      {resumeData && (
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Live Preview — {TEMPLATES[selectedTemplate]?.name}</p>
          <div className="bg-[#f5f5f7] rounded-xl p-6 overflow-auto max-h-[700px]">
            <div dangerouslySetInnerHTML={{ __html: renderTemplate(selectedTemplate, resumeData) }} />
          </div>
        </div>
      )}
    </div>
  )
}
