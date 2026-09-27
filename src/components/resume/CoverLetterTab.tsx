// src/components/resume/CoverLetterTab.tsx
'use client'
import { useState } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { Button, Card } from '@/components/ui/primitives'
import { FileText, Copy, Download, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CoverLetterTone } from '@/types/resume'

const TONES: { id: CoverLetterTone; label: string; desc: string }[] = [
  { id: 'professional',  label: 'Professional',  desc: 'Formal, polished, corporate' },
  { id: 'enthusiastic',  label: 'Enthusiastic',  desc: 'Warm, energetic, startup-ready' },
  { id: 'concise',       label: 'Concise',        desc: '~220 words, get to the point' },
  { id: 'storytelling',  label: 'Storytelling',  desc: 'Narrative hook, memorable' },
]

export function CoverLetterTab({ resumeId }: { resumeId: string }) {
  const { resumeData, jobDescription, byokCreds, addToast } = useResumeStore()
  const [tone, setTone]           = useState<CoverLetterTone>('professional')
  const [localJD, setLocalJD]     = useState(jobDescription)
  const [content, setContent]     = useState('')
  const [subjectLine, setSubject] = useState('')
  const [generating, setGenerating] = useState(false)

  async function generate() {
    if (!resumeData || !byokCreds.apiKey) { addToast('Add API key first', 'error'); return }
    if (!localJD.trim()) { addToast('Paste a job description first', 'error'); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, resumeData, jobDescription: localJD, tone, creds: byokCreds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContent(data.content)
      setSubject(data.subjectLine)
      addToast('Cover letter generated ✓', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Generation failed', 'error')
    }
    setGenerating(false)
  }

  function copyContent() {
    navigator.clipboard.writeText(content)
    addToast('Copied to clipboard', 'success')
  }

  function downloadTxt() {
    const blob = new Blob([content], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'cover_letter.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto px-6 py-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <FileText size={16} className="text-violet-400" />
        <h2 className="font-bold text-lg">Cover Letter Generator</h2>
      </div>

      {/* Tone */}
      <div className="mb-5">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Tone</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {TONES.map(t => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={cn(
                'p-3 rounded-lg border text-left transition-all',
                tone === t.id
                  ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                  : 'border-white/8 bg-[#16161d] text-slate-400 hover:border-white/15 hover:text-slate-300'
              )}
            >
              <p className="text-xs font-semibold mb-0.5">{t.label}</p>
              <p className="text-xs opacity-70">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* JD */}
      <Card className="mb-5">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Job Description</p>
        <textarea
          rows={5}
          value={localJD}
          onChange={e => setLocalJD(e.target.value)}
          placeholder="Paste the job description here…"
          className="w-full bg-[#1c1c24] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none mb-3"
        />
        <Button variant="primary" onClick={generate} loading={generating} disabled={!localJD.trim()}>
          <Sparkles size={13} />
          {generating ? 'Generating…' : content ? 'Regenerate' : 'Generate Cover Letter'}
        </Button>
      </Card>

      {/* Result */}
      {content && (
        <div className="fade-in space-y-4">
          {subjectLine && (
            <div className="bg-violet-500/8 border border-violet-500/20 rounded-lg px-4 py-3">
              <p className="text-xs font-mono text-violet-400 mb-1">Email Subject Line</p>
              <p className="text-sm font-medium text-slate-200">{subjectLine}</p>
            </div>
          )}

          <Card className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/7">
              <p className="text-xs font-mono text-slate-500">Cover Letter</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={copyContent}><Copy size={12} />Copy</Button>
                <Button size="sm" onClick={downloadTxt}><Download size={12} />Download</Button>
              </div>
            </div>
            <textarea
              rows={20}
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full bg-transparent px-4 py-3 text-sm text-slate-200 leading-relaxed focus:outline-none resize-none font-mono"
            />
          </Card>

          <p className="text-xs text-slate-600 text-center">You can edit the letter directly above before copying or downloading.</p>
        </div>
      )}
    </div>
  )
}
