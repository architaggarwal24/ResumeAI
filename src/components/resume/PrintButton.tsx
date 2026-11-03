// src/components/resume/PrintButton.tsx
'use client'

// The public share page is a Server Component, which cannot attach event
// handlers to DOM elements — the print button has to live in a client component.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="press shrink-0 rounded-xl bg-[linear-gradient(180deg,#a78bfa,#7c3aed_60%,#6d28d9)] px-3.5 py-2 text-xs font-medium text-white shadow-[0_8px_20px_-8px_rgba(124,58,237,.9)]"
    >
      Print / Save PDF
    </button>
  )
}
