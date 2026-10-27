# UI redesign — real components from your reference sites

## What I used (source copied under each library's licence)

All vendored files live in `src/components/vendor/<library>/`, each starting with an attribution comment. Full licence texts are in `THIRD_PARTY_NOTICES.md`.

| Site | Licence | Components now in the app | Where |
|---|---|---|---|
| **reactbits.dev** | MIT + Commons Clause | SoftAurora (WebGL hero), BlurText, RotatingText, ShinyText, CountUp, ScrollVelocity, StarBorder, Magnet, ClickSpark, SpotlightCard, HoldButton | Landing, dashboard, analytics, sidebar brand, hold-to-delete |
| **kokonutui.com** | MIT | MarkerText, BackgroundPaths, SmoothTab, AI Loading State, FileUpload | Hero headline, login/signup, editor tabs, scoring + import progress, PDF upload |
| **smoothui.dev** | MIT | FloatInput, ContributionGraph, ScrollRevealParagraph, FAQ block | Auth fields, analytics + landing activity graph, landing |
| **ui.unlumen.com** | MIT | Highlight (gliding hover/active background) | Sidebar nav, landing nav |
| **bklit.com** | MIT | Gauge, RadarChart, AreaChart, AreaSparkline (+ the shared chart files they need) | Score tab, landing demo, analytics, dashboard |

**Not used, and why:** originkit.dev (repo is only a plugin that fetches components behind an API key), animmasterlib.dev (paid pack), animos.app and swishy.ai (video-export tools, not UI libraries).
Three vendored files have small, commented modifications (see notices).

## New packages
`motion`, `@number-flow/react`, `@visx/{curve,event,grid,group,responsive,scale,shape}`, `d3-array`, `d3-shape`, `react-use-measure` (+ `@types/d3-*`). Run `npm install`.

## What changed on screen
- **Landing:** WebGL aurora behind the hero, hand-drawn marker highlight on the headline, word-blur-in copy, rotating audience pill, star-border CTA with magnetic pull, cursor spark on click, live Bklit gauge + radar demo, provider marquee that reacts to scroll speed, scroll-driven text reveal, count-up stats, spotlight bento tiles, activity graph, FAQ.
- **Login / signup:** split layout, interactive flowing-line canvas, floating-label inputs.
- **Dashboard + sidebar:** animated title, count-up stats with a sparkline, spotlight cards with score rings, hold-to-delete, gliding nav highlight.
- **Resume editor:** pill tabs with a sliding indicator; Bklit gauge + radar; Kokonut agent-style loader (live timer and log lines) while scoring.
- **Analytics:** Bklit area chart with tooltip, contribution graph, count-up stats.
- **Upload:** Kokonut drop zone → real 3-step progress.
- Responsive: mobile drawer nav, single-column bento, scrollable tabs. Motion respects `prefers-reduced-motion` where the libraries support it.

## How I checked it
I installed dependencies in a scratch copy, ran a real `next build` (type-check included), served it, and took screenshots with headless Chromium at desktop and mobile widths. For logged-in screens I used a preview harness with mock data (not shipped). This caught several bugs I fixed: server→client function props, radar label clipping, aurora colour, FAQ background, marquee rows, mobile grid overflow, Bklit's out-of-date docs vs. its real types.

**Not covered:** I haven't clicked through the real authenticated flows against Supabase, so test sign-in, upload → score → tailor, share links and export yourself. Pages I didn't redesign (jobs, settings, build, interview, cover letter, history, ATS tab) keep their layout but pick up the new colours and fonts.

## Tips
- WebGL aurora and canvas paths are the heaviest effects. To tone them down, remove `SoftAurora` from `src/app/page.tsx` or lower `count` on `BackgroundPaths` in `AuthShell`.
