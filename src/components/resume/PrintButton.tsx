// src/components/resume/PrintButton.tsx
'use client'

// The public share page is a Server Component, which cannot attach event
// handlers to DOM elements — the print button has to live in a client component.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
    >
      Print / Save PDF
    </button>
  )
}
