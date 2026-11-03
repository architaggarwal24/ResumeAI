// src/components/ui/ToastContainer.tsx
'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useResumeStore } from '@/store/resumeStore'
import { cn } from '@/lib/utils'
import { SPRING } from '@/lib/motion'
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react'

const icons = {
  success: <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />,
  error:   <AlertCircle size={16} className="shrink-0 text-rose-300" />,
  info:    <Info size={16} className="shrink-0 text-sky-300" />,
  loading: <Loader2 size={16} className="spin shrink-0 text-violet-300" />,
}

const accent = {
  success: 'from-emerald-400/70',
  error: 'from-rose-400/70',
  info: 'from-sky-400/70',
  loading: 'from-violet-400/70',
}

export function ToastContainer() {
  const { toasts, removeToast } = useResumeStore()

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed bottom-24 right-4 z-[80] flex w-[min(92vw,24rem)] flex-col gap-2 sm:bottom-6 sm:right-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.95, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18 } }}
            transition={SPRING.soft}
            className="glass-strong pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-sm"
            role={t.type === 'error' ? 'alert' : 'status'}
          >
            <span aria-hidden className="edge" />
            <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1 bg-gradient-to-b to-transparent', accent[t.type])} />
            {icons[t.type]}
            <span className="flex-1 text-slate-100">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => removeToast(t.id)}
              className="press -mr-1 grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-white"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
