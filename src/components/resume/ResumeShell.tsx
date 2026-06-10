'use client'
import { useEffect } from 'react'
import { useResumeStore } from '@/store/resumeStore'
import { ScoreTab }       from './ScoreTab'
import { EditorTab }      from './EditorTab'
import { ATSTab }         from './ATSTab'
import { TemplatesTab }   from './TemplatesTab'
import { CoverLetterTab } from './CoverLetterTab'
import { HistoryTab }     from './HistoryTab'
import { ShareManager }   from './ShareManager'
import { ChatDrawer }     from '@/components/chat/ChatDrawer'
import { cn }             from '@/lib/utils'
import type { ResumeRow, AnalysisResult, ResumeTab } from '@/types/resume'
import { BarChart2, Edit3, Zap, Layout, FileText, History, Link2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const TABS: { id: ResumeTab; label: string; icon: React.ReactNode }[] = [
  { id: 'score',        label: 'Score',        icon: <BarChart2 size={14}/> },
  { id: 'editor',       label: 'Edit',         icon: <Edit3     size={14}/> },
  { id: 'ats',          label: 'ATS vs JD',    icon: <Zap       size={14}/> },
  { id: 'templates',    label: 'Templates',    icon: <Layout    size={14}/> },
  { id: 'cover-letter', label: 'Cover Letter', icon: <FileText  size={14}/> },
  { id: 'history',      label: 'History',      icon: <History   size={14}/> },
  { id: 'share',        label: 'Share',        icon: <Link2     size={14}/> },
]

interface Props { resume: ResumeRow; initialAnalysis: AnalysisResult | null }

export function ResumeShell({ resume, initialAnalysis }: Props) {
  const { activeTab, setActiveTab, setResumeData, setResumeId, setSelectedTemplate, setAnalysisResult } = useResumeStore()

  useEffect(() => {
    setResumeId(resume.id)
    setResumeData(resume.parsed_data)
    setSelectedTemplate(resume.template_id ?? 'classic')
    if (initialAnalysis) setAnalysisResult(initialAnalysis)
  }, [resume.id]) // eslint-disable-line

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-6 h-14 border-b border-white/7 bg-[#111116] shrink-0">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ChevronLeft size={18}/>
        </Link>
        <h1 className="font-semibold text-sm truncate flex-1">{resume.name}</h1>
        {resume.ats_score != null && (
          <span className={cn(
            'text-xs font-mono font-bold px-2 py-1 rounded-lg border',
            resume.ats_score >= 70 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
            resume.ats_score >= 45 ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
                                     'text-red-400 bg-red-400/10 border-red-400/20'
          )}>
            ATS {Math.round(resume.ats_score)}/100
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-4 border-b border-white/7 bg-[#111116] shrink-0 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-all border-b-2 -mb-px whitespace-nowrap',
              activeTab === tab.id
                ? 'text-violet-300 border-violet-500'
                : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-white/20'
            )}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="fade-in">
          {activeTab === 'score'        && <ScoreTab       resumeId={resume.id}/>}
          {activeTab === 'editor'       && <EditorTab      resumeId={resume.id}/>}
          {activeTab === 'ats'          && <ATSTab         resumeId={resume.id}/>}
          {activeTab === 'templates'    && <TemplatesTab   resumeId={resume.id}/>}
          {activeTab === 'cover-letter' && <CoverLetterTab resumeId={resume.id}/>}
          {activeTab === 'history'      && <HistoryTab     resumeId={resume.id}/>}
          {activeTab === 'share'        && (
            <div className="mx-auto px-6 py-6 max-w-2xl">
              <h2 className="font-bold text-lg mb-6">Share Resume</h2>
              <ShareManager resumeId={resume.id}/>
            </div>
          )}
        </div>
      </div>

      {/* AI Chat Drawer — always available on resume pages */}
      <ChatDrawer/>
    </div>
  )
}
