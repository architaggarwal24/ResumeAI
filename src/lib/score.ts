// src/lib/score.ts
export function scoreHex(score: number): string {
  return score >= 70 ? '#34d399' : score >= 45 ? '#fcd34d' : '#fb7185'
}
export function scoreWord(score: number): string {
  return score >= 70 ? 'Strong' : score >= 45 ? 'Needs work' : 'Weak'
}
