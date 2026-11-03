// src/app/fonts.ts
// Self-hosted variable fonts (SIL OFL 1.1 — see THIRD_PARTY_NOTICES.md).
// Local files keep the strict CSP (`font-src 'self'`) and make builds work offline.
import localFont from 'next/font/local'

export const fontSans = localFont({
  src: './fonts/SpaceGrotesk-Variable.woff2',
  variable: '--font-space-grotesk',
  weight: '300 700',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
})

export const fontMono = localFont({
  src: './fonts/JetBrainsMono-Variable.woff2',
  variable: '--font-jetbrains-mono',
  weight: '100 800',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
})
