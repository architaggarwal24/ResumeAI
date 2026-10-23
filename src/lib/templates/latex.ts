// src/lib/templates/latex.ts
// LaTeX text escaping, done in a SINGLE pass so replacement output is never
// re-escaped (the previous chained .replace() turned the braces inside
// "\textbackslash{}" into "\{\}", corrupting any resume text with a backslash).
const MAP: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&', '%': '\\%', '$': '\\$', '#': '\\#', '_': '\\_', '{': '\\{', '}': '\\}',
  '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
}

export function texEscape(s: unknown): string {
  if (s === null || s === undefined || s === '') return ''
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/\u0000/g, '').replace(/[\\&%$#_{}~^]/g, c => MAP[c])
}
