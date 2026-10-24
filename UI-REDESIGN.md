# UI redesign notes

## What I could and couldn't use from the reference sites

All eleven were reviewed. None of their code was copied: most are copy-paste libraries with Pro tiers or "no-license" listings, and I couldn't run their CLIs here. Every component below is an original implementation of a *pattern* those sites showcase, with no new dependencies.

| Site | What it is | What I took |
|---|---|---|
| **bklit.com** | Chart components | Gauge, radar and area charts (`ScoreGauge`, `RadarChart`, `AreaChart`) |
| **kokonutui.com** | AI-flavoured shadcn components | Agent-step loader (`AgentSteps`), score ring (`MiniRing`), swipe tabs (`SlidingTabs`), marker text (`.marker`), magnet button (`Magnetic`), file-drop states |
| **componentry.dev** | Animated heroes / text | Flipping word swap (`FlipWords`), grain-gradient backdrop (`Aurora`), contribution calendar (`ActivityCalendar`) |
| **ui.unlumen.com** | shadcn animation library (blocks bots; reviewed via search snippets) | Gliding hover highlight (sidebar nav, tabs), copy-button icon pop (`CopyButton`), cursor spotlight |
| **smoothui.dev** | Animated shadcn components + design essays | Number-flow digits (`AnimatedNumber`), stats strip + FAQ blocks. Its "AI design slop" essay is why I moved off purple gradients/glass |
| **uiarc.dev** | Motion-first React components | Count-to-value numbers, inline confirm-with-timer (`DeleteResumeButton`), title reveals |
| **reactbits.dev** | Animated React components | Shiny text, spotlight card, blur-in reveals, rotating border beam |
| **originkit.dev** | Animated component library | Page rendered client-side, so I got no readable content. Nothing taken |
| **animmasterlib.dev** | Paid component pack (Google Drive delivery) | Nothing: paid code, can't and shouldn't replicate |
| **animos.app / swishy.ai** | Video/motion-export tools, not UI libraries | Nothing in-app. Useful later for a landing-page demo video |

## Identity change (and why)

The previous pass was violet gradients + frosted glass + six identical cards: the exact "AI slop" look SmoothUI's essay criticises. New direction, "editor's desk":

- **Ink-black neutral surfaces**, **verdigris teal** as the working colour, **amber highlighter** as the single emphasis accent (marker swipes, quick-win callouts, the logo dot).
- **Serif display face** (system serif stack, so zero font downloads) for headings and big numbers.
- The whole old `violet-*` scale is remapped in one `@theme` block in `globals.css`, so ~200 existing usages recolour without per-file edits.
- Solid surfaces instead of backdrop blur; ruled-paper texture and grain instead of glowing blobs.

## Where the new pieces live

- Landing page (`/`): left-aligned hero with rotating words and marker highlight, live gauge + radar sample, factual stats strip, asymmetric bento (each tile previews its feature), privacy block, FAQ.
- Score tab: tick-mark gauge + radar replace the plain ring; step-by-step progress replaces the skeleton.
- Resume editor: sliding-indicator tabs with keyboard arrows.
- Analytics: area chart with hover tooltip, activity calendar, animated stats, responsive grid.
- Dashboard: mini score rings (one score display instead of three), inline confirm-delete (also visible on touch/keyboard, which the old hover-only button wasn't).
- Upload: keyboard-accessible drop zone, real 3-step progress, honest privacy copy.
- Sidebar: gliding hover highlight; mobile drawer.

All motion respects `prefers-reduced-motion`. Charts expose `role="img"` with text labels.

## Not verified

I can't run a browser here: check spacing, contrast and the CSS `@property`/mask effects visually, and run `npm run build` (your last build is the only real compile this code has had).
