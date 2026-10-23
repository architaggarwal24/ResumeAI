// src/app/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Aurora } from '@/components/ui/fx/Aurora'
import { BlurFade } from '@/components/ui/fx/BlurFade'
import { SpotlightCard } from '@/components/ui/fx/SpotlightCard'
import { Sparkles, Upload, Wand2, Briefcase, BarChart2, MessageSquare, Link2, Key, Lock, Zap, FileText, ChevronRight, Check } from 'lucide-react'

export const dynamic = 'force-dynamic'

const FEATURES = [
  { icon: BarChart2,     title: 'Recruiter-style scoring',  body: 'Section-by-section scores, a blunt recruiter verdict, missing keywords and the five fixes that move the needle most.' },
  { icon: Zap,           title: 'ATS match for any job',    body: 'Paste a job description and see exactly which keywords and skills you are missing before you apply.' },
  { icon: Wand2,         title: 'One-click tailoring',      body: 'Spin a tailored copy of your resume for each role. Your original is snapshotted first, always.' },
  { icon: FileText,      title: 'Cover letters',            body: 'Four tones, grounded in your actual resume and the posting — no generic filler.' },
  { icon: MessageSquare, title: 'Mock interviews',          body: 'Practice with an interviewer that has read your resume, then get a scored debrief and a study plan.' },
  { icon: Link2,         title: 'Private share links',      body: 'Share a resume by link with optional password and expiry. Revoke it any time.' },
]

const STEPS = [
  { icon: Upload,    title: 'Upload or build', body: 'Drop in a PDF, import from LinkedIn, or build from scratch.' },
  { icon: Sparkles,  title: 'Get scored',      body: 'See what a recruiter and an ATS would see — with specific rewrites.' },
  { icon: Briefcase, title: 'Tailor & track',  body: 'Tailor per job and keep every application in one tracker.' },
]

export default async function HomePage() {
  // Signed-in users go straight to their dashboard (unchanged behaviour).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#0c0c0f] text-slate-100">
      <Aurora />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-violet-500 shadow-lg shadow-violet-500/60" />
          <span className="text-lg font-bold tracking-tight">ResumeAI</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:text-white">Sign in</Link>
          <Link href="/signup" className="btn-sheen rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-transform hover:-translate-y-px">Get started</Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-center sm:pt-24">
          <div className="blur-in mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            <Sparkles size={12} className="text-violet-300" />
            Bring your own AI key · nothing you write trains a model
          </div>
          <h1 className="blur-in text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl" style={{ '--d': '80ms' } as React.CSSProperties}>
            Your resume, <span className="shiny-text">scored like a recruiter</span> would score it.
          </h1>
          <p className="blur-in mx-auto mt-6 max-w-2xl text-pretty text-base text-slate-400 sm:text-lg" style={{ '--d': '180ms' } as React.CSSProperties}>
            Upload a resume, see exactly what&apos;s holding it back, tailor it to every job, and rehearse the interview — using your own Anthropic, OpenAI, Gemini, OpenRouter or NVIDIA key.
          </p>
          <div className="blur-in mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ '--d': '280ms' } as React.CSSProperties}>
            <Link href="/signup" className="border-beam btn-sheen inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(180deg,#8b7bff,#6a58e6)] px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-900/40 ring-1 ring-inset ring-white/15 transition-transform hover:-translate-y-0.5">
              Start free <ChevronRight size={15} />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10">
              I have an account
            </Link>
          </div>

          {/* Product glimpse */}
          <div className="blur-in glass float-y relative mx-auto mt-16 max-w-2xl rounded-2xl p-5 text-left" style={{ '--d': '420ms' } as React.CSSProperties}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20"><FileText size={15} className="text-violet-300" /></div>
                <div>
                  <p className="text-sm font-semibold">Senior Engineer — Resume</p>
                  <p className="text-xs text-slate-500">Scored just now</p>
                </div>
              </div>
              <div className="font-mono text-3xl font-bold text-emerald-400">82</div>
            </div>
            {[['Experience', 88, '#34d399'], ['Skills', 79, '#34d399'], ['Summary', 61, '#fbbf24']].map(([label, v, c]) => (
              <div key={label as string} className="mb-2.5 last:mb-0">
                <div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">{label}</span><span className="font-mono text-slate-300">{v}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${v}%`, background: c as string }} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <BlurFade className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Everything between <span className="gradient-text">“applied”</span> and “offer”</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">One workspace for the resume, the job hunt and the interview.</p>
          </BlurFade>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <BlurFade key={title} delay={i * 70}>
                <SpotlightCard className="h-full p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/15 ring-1 ring-inset ring-violet-400/20">
                    <Icon size={18} className="text-violet-300" />
                  </div>
                  <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{body}</p>
                </SpotlightCard>
              </BlurFade>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <BlurFade key={title} delay={i * 90}>
                <div className="relative rounded-xl border border-white/7 bg-[#111116] p-6">
                  <span className="absolute right-5 top-4 font-mono text-4xl font-bold text-white/5">{i + 1}</span>
                  <Icon size={18} className="mb-3 text-cyan-300" />
                  <h3 className="mb-1 text-sm font-semibold">{title}</h3>
                  <p className="text-sm text-slate-400">{body}</p>
                </div>
              </BlurFade>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section className="mx-auto max-w-4xl px-6 pb-24">
          <BlurFade>
            <div className="glass rounded-2xl p-8 sm:p-10">
              <div className="mb-5 flex items-center gap-2 text-violet-300"><Lock size={16} /><span className="text-xs font-mono uppercase tracking-widest">Privacy by design</span></div>
              <h2 className="mb-5 text-xl font-bold tracking-tight sm:text-2xl">Your key. Your data. Your call.</h2>
              <ul className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                {[
                  'API keys live in your browser tab only and are never saved to our database.',
                  'Each AI request is relayed to your provider and then forgotten.',
                  'Share links are optional, password-protectable, expiring and revocable.',
                  'Delete your resumes any time from Settings.',
                ].map(t => (
                  <li key={t} className="flex gap-2.5"><Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />{t}</li>
                ))}
              </ul>
              <div className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Key size={13} />Works with Anthropic, OpenAI, Gemini, OpenRouter and NVIDIA NIM.</div>
            </div>
          </BlurFade>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-28 text-center">
          <BlurFade>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to see your <span className="gradient-text">real</span> score?</h2>
            <Link href="/signup" className="btn-sheen mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-slate-900 transition-transform hover:-translate-y-0.5">
              Create free account <ChevronRight size={15} />
            </Link>
          </BlurFade>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/7 py-8 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} ResumeAI
      </footer>
    </div>
  )
}
