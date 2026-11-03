# UI redesign — "Glass Desk" (purple + black)

A full visual and motion redesign of every screen. No API, Supabase, store or LLM logic was changed.

## Design system
- **Colour:** purple-black ink (`#08070b`), violet as the working colour (`violet-*` scale in `globals.css`), fuchsia as the highlighter. Score semantics stay traffic-light (emerald ≥70, amber 45–69, rose <45).
- **Type:** Space Grotesk (UI + display) and JetBrains Mono (numbers, labels), self-hosted in `src/app/fonts/` via `next/font/local` (CSP-safe, OFL — see `THIRD_PARTY_NOTICES.md`).
- **Surfaces:** `.glass`, `.glass-strong`, `.glass-subtle` + `.edge` (gradient hairline). Component classes live in `@layer components` so Tailwind utilities on the same element always win.
- **Motion:** springs and variants in `src/lib/motion.ts`. `MotionProvider` (`components/ui/glass/MotionTier.tsx`) picks a tier — `full` (capable desktop: WebGL aurora, cursor glow, tilt, magnetic buttons), `lite` (touch / ≤4 cores / ≤4 GB / Save-Data: CSS motion only) or `off` (reduced motion) — and mirrors it to `<html data-motion>`.

## Shared kit — `src/components/ui/glass/`
`Button` / `IconButton` (magnetic, ripple, sheen, beam, loading), `GlassPanel` (spotlight + tilt), `Field` (floating-label input), `Reveal` / `RevealGroup` / `TextReveal`, `Badge`, `Kbd`, `Eyebrow`, `Skeleton`, `Marquee`, `AuroraBackdrop`, `CursorGlow`, `ScrollProgress`, `SectionGlow`.
Legacy `components/ui/primitives.tsx` keeps its API but renders on the new system.

## Screens
- **Landing:** WebGL aurora hero with a 3D resume that scores itself, scroll-story "How it works", interactive feature bento, privacy flow, stats, FAQ accordion, closing CTA.
- **Auth:** aurora split layout, glass card, floating-label fields, password strength meter, animated confirmation.
- **App shell:** collapsible floating glass sidebar (gliding active pill, primary "New resume", ⌘K search, notifications, account), mobile top bar + 5-slot dock + swipe-down sheet, page transitions.
- **Command palette, notifications, toasts, AI coach drawer:** glass, spring motion, Lucide icons instead of emoji, full keyboard support.
- **Dashboard:** "next best step" card with progress to the 70-point line, live stat counters, tilt resume cards, illustrated empty state.
- **Upload / Build:** 3-step journey, custom drag-and-drop zone, progress ring; build wizard with sliding steps and sticky nav.
- **Resume editor:** glass header with score ring, sliding tab rail (arrow-key navigation), animated tab panels, restyled score hero and collapsible section rows. All other tabs pick up the new surfaces.
- **Jobs / Analytics / Settings / Interview / Share page:** restyled on the same system; jobs board scrolls horizontally with snap on small screens.

## Verified
`next build` (type-check) passes; ESLint reports no new problems (remaining ones are pre-existing, in vendored files and API routes). Screens were checked with headless Chromium at 1440×900 and 390×844 using a mock-data preview harness that is not shipped. Real Supabase sign-in, upload → score → tailor, share links and export still need a manual click-through.

## Unused files you can delete
These are no longer imported anywhere (drag-and-drop can't remove them, and they are harmless if left):
`src/components/landing/HeroDemo.tsx`; in `src/components/vendor/` — `kokonut/{smooth-tab,file-upload,background-paths,marker-text}.tsx`, `smoothui/{float-input,faq-1,scroll-reveal-paragraph}.tsx`, `unlumen/highlight.tsx`, `react-bits/{ShinyText,BlurText,Magnet,ScrollVelocity,StarBorder,RotatingText}.tsx`.

## Performance (smooth on mid-range and low-end devices)
- **Effects are earned, not assumed.** Every device starts on the light tier. Heavy effects (WebGL aurora, cursor glow, card tilt, drifting light, frosted overlays) switch on only if the device looks capable *and* holds ≥50fps in a 1-second probe after the page settles. A watchdog keeps sampling every 10s and drops back to light if it struggles; that choice is remembered for 7 days. Logic: `src/lib/motion-governor.ts` (unit-tested), wiring: `MotionTier.tsx`.
- **No GPU-heavy layers.** Backdrop blur only on things that float over content (nav, menus, dialogs, toasts, dock) and only on the full tier; cards use a translucent fill instead. The aurora and section glows no longer use `filter: blur()` or blend modes; the film grain no longer blends.
- **Light tier** also stops beams, shimmer and drifting light, and uses entrances without animated blur.
- **Nothing runs off-screen.** The hero demo and the cover-letter typing only tick while visible; the hero scan beam and keyword bar animate transforms, not layout. Far-down sections use `content-visibility: auto`. App screens use a static background light.
