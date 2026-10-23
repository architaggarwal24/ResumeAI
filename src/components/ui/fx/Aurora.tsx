// src/components/ui/fx/Aurora.tsx
// Decorative animated backdrop (CSS only — no JS, safe in Server Components).
export function Aurora({ grid = true }: { grid?: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden noise">
      <div className="aurora" />
      {grid && <div className="grid-bg" />}
    </div>
  )
}
