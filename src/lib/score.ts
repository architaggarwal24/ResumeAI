// src/lib/score.ts
export function scoreHex(score: number): string {
  return score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'
}
export function scoreWord(score: number): string {
  return score >= 70 ? 'Strong' : score >= 45 ? 'Needs work' : 'Weak'
}
