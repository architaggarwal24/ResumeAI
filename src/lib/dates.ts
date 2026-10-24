// src/lib/dates.ts
/** Local-date key "YYYY-MM-DD" (not UTC), safe to import from server and client code. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
