'use client'
// src/components/ui/glass/Field.tsx
// Glass text field with a label that floats *inside* the field (no backdrop
// colour to match, so it works on any glass surface). Visible label always —
// never placeholder-only. Error/hint text sits right under the field.
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  hint?: ReactNode
  error?: string
  leading?: ReactNode
  trailing?: ReactNode
  containerClassName?: string
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, leading, trailing, className, containerClassName, id, value, defaultValue, onFocus, onBlur, ...rest },
  ref,
) {
  const auto = useId()
  const inputId = id ?? `f-${auto.replace(/:/g, '')}`
  const [focus, setFocus] = useState(false)
  const filled = value !== undefined ? String(value).length > 0 : false
  const up = focus || filled || !!rest.placeholder
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined

  return (
    <div className={containerClassName}>
      <div
        className={cn(
          'group relative flex h-14 items-center rounded-2xl border bg-white/[0.035] transition-[border-color,background-color,box-shadow] duration-200',
          error ? 'border-rose-400/50' : focus ? 'border-violet-300/60 bg-white/[0.05] shadow-[0_0_0_4px_rgba(139,92,246,.16)]' : 'border-white/10 hover:border-white/20',
        )}
      >
        {leading && <span className="pl-4 text-slate-400">{leading}</span>}
        <div className="relative h-full flex-1">
          <label
            htmlFor={inputId}
            className={cn(
              'pointer-events-none absolute left-4 origin-left transition-all duration-200 ease-[cubic-bezier(.16,1,.3,1)]',
              up ? 'top-2.5 text-[11px] font-medium tracking-wide' : 'top-1/2 -translate-y-1/2 text-sm',
              error ? 'text-rose-300' : focus ? 'text-violet-200' : 'text-slate-400',
            )}
          >
            {label}
          </label>
          <input
            ref={ref}
            id={inputId}
            value={value}
            defaultValue={defaultValue}
            aria-invalid={!!error || undefined}
            aria-describedby={describedBy}
            onFocus={e => { setFocus(true); onFocus?.(e) }}
            onBlur={e => { setFocus(false); onBlur?.(e) }}
            className={cn('h-full w-full bg-transparent px-4 pb-2 pt-6 text-[15px] text-white outline-none placeholder:text-slate-600', className)}
            {...rest}
          />
        </div>
        {trailing && <span className="pr-3">{trailing}</span>}
      </div>
      {error ? (
        <p id={`${inputId}-err`} role="alert" className="mt-1.5 px-1 text-xs text-rose-300">{error}</p>
      ) : hint ? (
        <div id={`${inputId}-hint`} className="mt-1.5 px-1 text-xs text-slate-500">{hint}</div>
      ) : null}
    </div>
  )
})
