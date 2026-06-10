'use client'
import { useResumeStore } from '@/store/resumeStore'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react'

const icons = {
  success: <CheckCircle size={15} className="text-emerald-400 shrink-0" />,
  error:   <AlertCircle size={15} className="text-red-400 shrink-0" />,
  info:    <Info size={15} className="text-blue-400 shrink-0" />,
  loading: <Loader2 size={15} className="text-violet-400 shrink-0 spin" />,
}

export function ToastContainer() {
  const { toasts, removeToast } = useResumeStore()

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'fade-in flex items-center gap-3 px-4 py-3 rounded-lg border text-sm max-w-sm pointer-events-auto',
            'bg-[#16161d] shadow-xl',
            t.type === 'success' && 'border-emerald-500/25',
            t.type === 'error'   && 'border-red-500/25',
            t.type === 'info'    && 'border-blue-500/25',
            t.type === 'loading' && 'border-violet-500/25',
          )}
        >
          {icons[t.type]}
          <span className="flex-1 text-slate-200">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="text-slate-500 hover:text-slate-300 transition-colors ml-1"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
