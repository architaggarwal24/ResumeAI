// src/components/landing/HeroDemo.tsx
'use client'
import { SpotCard } from '@/components/ui/SpotCard'
import { Gauge, RadarChart, RadarGrid, RadarAxis, RadarLabels, RadarArea } from '@/components/vendor/bklit'

// Sample analysis shown in the hero, built with Bklit UI's gauge + radar charts.
const METRICS = [
  { key: 'summary', label: 'Summary' },
  { key: 'experience', label: 'Experience' },
  { key: 'skills', label: 'Skills' },
  { key: 'education', label: 'Education' },
  { key: 'projects', label: 'Projects' },
]
const DATA = [{ label: 'Your resume', color: '#3cc9ae', values: { summary: 61, experience: 88, skills: 79, education: 84, projects: 72 } }]

export function HeroDemo() {
  return (
    <SpotCard className="rounded-2xl! border-white/10 p-5! sm:p-6!">
      <div className="mb-4 flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-widest text-slate-500">Sample analysis</span>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">Shortlist-ready</span>
      </div>

      <div className="grid items-center gap-4 sm:grid-cols-2">
        <div className="mx-auto h-[210px] w-full max-w-[270px]">
          <Gauge value={82} centerValue={82} totalNotches={44} defaultLabel="ATS score" />
        </div>
        <div className="mx-auto w-full max-w-[270px]">
          <RadarChart data={DATA} metrics={METRICS} size={270} margin={62}>
            <RadarGrid showLabels={false} />
            <RadarAxis />
            <RadarLabels fontSize={11} offset={10} />
            <RadarArea index={0} />
          </RadarChart>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3.5 py-3">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-300/80">Quickest win</p>
        <p className="font-display text-[15px] leading-snug text-slate-200">“Quantify the impact in your second role — hiring managers skim for numbers.”</p>
      </div>
    </SpotCard>
  )
}
