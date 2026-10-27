# ResumeAI — Security Audit & Remediation

Scope: full source review of the uploaded `ResumeAI.zip` (Next.js 16 App Router + Supabase + BYOK LLM proxy), then fixes.
Date: 2026-10-23.

## How this was done (and what it is not)

- **Method:** single-pass, source-first review following the `security-audit` skill's evidence bar and severity anchors. Trust boundaries read first (middleware, Supabase clients, RLS, SECURITY DEFINER functions), then every API route, then client-side sinks.
- **Not done:** the skill's multi-agent hunting waves and independent verifiers (no sub-agent tool in this environment). Treat this as one careful reviewer's pass, not exhaustive coverage.
- **Evidence:** pure logic was reproduced locally in scratch harnesses (no target code executed, no network). Postgres was not available, so **SQL findings are source-reviewed, not executed**.
- **Not run:** `npm install`, `npm audit`, `next build`, or the app. The audit rules forbid installing/executing target dependencies here, so **nothing was compiled or run end-to-end**. Type-checking was done with a global `tsc` and is limited by missing third-party types. See "Verify before deploying".

## Findings

Severity reflects real impact given preconditions. "Confirmed" = demonstrated locally or unambiguous from source + platform semantics.

### Medium

**M1 — pdf.js 3.11.174 loaded from cdnjs without SRI (CVE-2024-4367)** · `src/lib/pdf/extract.ts` · *Confirmed from source + public advisory; exploit not reproduced locally*
The PDF parser was injected as a `<script>` from a CDN at a version affected by CVE-2024-4367 (JS execution when opening a crafted PDF; fixed in 4.2.67), with no integrity check. Script runs in the app origin, where BYOK API keys sit in `sessionStorage` and the session can call every API. Precondition: victim uploads an attacker-supplied PDF. The `pdfjs-dist` npm dependency was already declared but unused.
**Fix:** bundled `pdfjs-dist`, same-origin worker, `isEvalSupported:false`, `enableXfa:false`, `%PDF-` magic-byte check, 30-page cap, 30 s timeout, CDN removed. CSP now blocks third-party scripts.

**M2 — Share-insert RLS gap → cross-tenant resume read** · `001_initial.sql` `shares_owner` · *Confirmed from policy semantics; SQL not executed*
`FOR ALL USING (auth.uid() = user_id)` has no `WITH CHECK` on `resume_id`. Any logged-in user can `INSERT` a share row pointing at someone else's resume via PostgREST (the API route's ownership check is bypassable; FK checks skip RLS), then read it through `get_shared_resume()`. Needs the victim's resume UUID (unguessable, but visible in URLs/logs/screen shares).
**Fix:** migration 003 adds `WITH CHECK` requiring the resume to belong to the caller. Same fix for `job_applications.resume_id`.

**M3 — Share-password brute force unthrottled** · `get_shared_resume` · *Confirmed from source; not executed*
`anon` can call `POST /rest/v1/rpc/get_shared_resume` directly with unlimited guesses and no password policy (any length ≥ 1), and each guess costs a bcrypt. Weak passwords on a leaked link are crackable online.
**Fix:** DB-level lockout (10 failures / 15 min per slug, advisory-locked so parallel guesses can't race; no bcrypt while locked), route-level per-IP+slug limiter, password length 6–128. Trade-off: someone with the slug can lock it out for others.

### Low

| # | Issue | Where | Fix |
|---|---|---|---|
| L1 | **Open redirect after auth.** `${origin}${next}` with `next=@evil.example` or `.evil.example` yields an attacker host (reproduced). Practically hard to exploit: needs a *valid* PKCE code for the victim's browser. | `auth/callback/route.ts` | `safeNextPath()` allows same-origin absolute paths only |
| L2 | **Gemini path/query injection.** User-controlled `model` interpolated into the URL (reproduced: rewrites path to `/v1beta/openai/...`); API key in query string (ends up in logs). Host stays fixed. | `api/llm`, `api/chat`, `api/mock-interview`, `api/test-connection` | model allowlist regex + `encodeURIComponent`; key moved to `x-goog-api-key` header |
| L3 | **Server called its own `/api/llm` over HTTP**, forwarding the session cookie to a URL built from env or (in `test-connection`) the request's own origin. SSRF-shaped; exploitability depends on host-header handling of the deploy platform (**needs validation**). | `lib/llm/client.ts`, 6 routes | new `lib/llm/server.ts` (`runLLM`, `callLLMServer`, `streamLLMText`); no HTTP hop, no cookie forwarding |
| L4 | **PostgREST `.or()` filter built by string interpolation** (reproduced: attacker clauses accepted). Still ANDed with `user_id`, so own-data only. | `api/search` | LIKE-escape + two separate `ilike` queries |
| L5 | **`javascript:` URLs** stored in job `url` and rendered in `<a href>`; notification `href` passed to `router.push`. Self-XSS only (own rows), but same origin as BYOK keys. | `api/jobs`, `api/notifications`, jobs page, `NotificationBell` | `safeHttpUrl` / `safeInternalHref` server + client; DB `CHECK` constraints |
| L6 | **LinkedIn import followed redirects**, allowed `http:`, unbounded body. Needs an open redirect on LinkedIn to matter. | `api/linkedin` | https only, exact host, `redirect:'manual'`, 2 MB cap |
| L7 | **No input bounds/shape validation.** Unbounded bodies; unvalidated `parsed_data` stored and later rendered server-side on the public share page (wrong types crash SSR; LLM output steerable by hostile job postings was saved unvalidated). Unbounded versions/resumes/shares per user. | all write routes | `readJsonLimited`, `sanitizeResumeData`, template/status/tone allowlists, per-user caps |
| L8 | **No rate limiting** on LLM-backed/CPU-heavy routes (60 s functions). | all AI routes, export | per-user limiter (see caveat below) |
| L9 | **No security headers / CSP.** | `next.config.ts` | CSP (no third-party origins besides Supabase), `frame-ancestors 'none'`, nosniff, HSTS, Referrer/Permissions/COOP policies; `Cache-Control: no-store` on `/api/*` |
| L10 | **Error/log leakage.** Raw `err.message` returned to clients; raw model output (contains resume PII) logged on parse failure. | many | generic errors; logs carry shape only (covered by a test) |

### Hardening / latent

- **`users` self-update (latent privilege escalation).** `users_own_row` let a client `UPDATE tier`/`analyses_count` via PostgREST. Nothing gates on `tier` today, so no current impact. Fixed with column-level grants (only `provider`, `model`, `display_name` updatable).
- **`increment_analyses_count` RPC was called but never defined** in any migration (counter silently never moved). Added, keyed on `auth.uid()`; drops any `uuid`-arg variant.
- **Misleading privacy copy.** Settings said keys are "never sent to our servers"; they transit our API on every AI request (the README was accurate). Copy corrected.
- Share slugs raised from 48 to 72 bits; share POST response no longer includes `password_hash`; `handle_new_user()` gets a pinned `search_path`; middleware now keeps refreshed session cookies on redirects; `esc()` also escapes `'`.

### Checked and found sound

Template HTML escaping (`esc()` holds for `& < > "`; no user data reaches attributes), Supabase `getUser()` (not `getSession()`) in middleware, resume/version/job/notification ownership via RLS, no secrets in the zip, LLM provider hosts are fixed server-side (no user-supplied base URL reachable), LaTeX output cannot execute commands.

### Non-security bugs fixed on the way

- **`next build` failed type-checking in the original** (`BYOKPanel.tsx` referenced `setBaseUrl`, `baseUrl` and an `'ollama'` provider that exist nowhere in the store/types). Removed the dead Ollama branches and the unused `ollama-guard.ts`. Confirmed by a real `next build` on Next 16.4.2: after this, TypeScript reported no other errors in the changed code.
- **Public share page** (a Server Component) passed `onClick` to a DOM button, which Next rejects → `PrintButton` client component.
- **LaTeX export** double-escaped backslashes (`\textbackslash\{\}`), corrupting text.
- **ShareManager** ignored failed responses and inserted `undefined` rows; now shows the error.
- Divider `<hr>` used `border-none border-t` (cancelled out) → real 1 px line.

## UI changes

Dependency-free equivalents of patterns popularised by the libraries you listed (I could not run their CLIs: no installs, and the sites are outside the sandbox allowlist, so nothing is copied):

- New public **landing page** (aurora + grid backdrop, shiny headline, rotating border-beam CTA, spotlight feature cards, scroll-reveal sections, honest privacy block). Signed-in users still redirect to `/dashboard`.
- **Auth pages**: shared `AuthShell` (glass card on aurora), icons, show/hide password, proper `autocomplete`, `role="alert"` errors.
- **App shell**: responsive (off-canvas drawer + top bar under `md`, Esc to close), active-route indicator with glow, gradient avatar, `aria-current`.
- **Dashboard**: cursor-follow `SpotlightCard`s, staggered `BlurFade`, `CountUp` stats, refined empty state.
- **Primitives/CSS**: gradient primary button with sheen, focus-visible rings, system font stack, all motion disabled under `prefers-reduced-motion`.
- New components: `components/ui/fx/{Aurora,BlurFade,SpotlightCard,CountUp}.tsx`.
- Not visually verified: I couldn't run the app, so spacing/contrast should get an eyeball pass in a browser.

## Verify before deploying

1. `npm ci && npm run build` — **nothing here was compiled by Next**. Highest-risk spots if something breaks: pdf.js worker URL in `extract.ts` (`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`), the CSP in `next.config.ts`, and the `@property`/mask CSS.
2. `npm test` (Node 22.18+): 70 unit tests for the pure helpers (redirect, URLs, sanitizer, limiter, body reader, creds validation, LaTeX, JSON extraction). Written red-first.
3. `npm audit` — dependencies were **not** audited.
4. Run `supabase/migrations/003_security_hardening.sql` in the SQL editor; then try: insert a share for another user's resume (must fail), update `users.tier` (must fail), 11 wrong share passwords (must lock).
5. Smoke test: PDF upload, LinkedIn paste, analyze/tailor/chat/mock interview, export (PDF/DOCX/LaTeX), create + open + unlock a share link.

## Residual risk / your call

- **Rate limits are per server instance** (in-memory). On serverless they are a brake, not a quota. Use an edge/WAF rule or a shared store (Upstash/Postgres) for hard limits. The DB-level share lockout *is* authoritative.
- **CSP keeps `'unsafe-inline'` for scripts** (App Router hydration) and styles (inline style attributes in templates). A nonce-based CSP is the next step.
- **`hash_share_password()`** is callable by any logged-in user and costs bcrypt CPU; folding hashing into a single `create_share` function would remove that. Not done.
- **Prompt injection** from resume/job text into the model is inherent. Model output is now sanitised before storage, which limits blast radius to the requesting user's own data.
- **Supabase dashboard settings (not in code):** restrict Auth redirect URLs to exact production origins (no broad wildcards), enable email confirmation and leaked-password protection, set a stronger minimum password length than the client's 8.
- `tsconfig.tsbuildinfo` shipped in the zip; `.gitignore` covers it but don't commit it.

## Addendum: dependency audit and third-party UI code

- `npm audit` could finally be run (dependencies were installed in a scratch copy). The lockfile pinned **Next.js 16.3.5**, which is inside several vulnerable ranges (including RCE advisories up to 16.4.0). Now pinned to **^16.4.3**, `sharp`, `source-map-js` and `zod` patched: **0 vulnerabilities** (prod and dev).
- The new UI uses copied open-source component source (see `THIRD_PARTY_NOTICES.md`). I scanned it for network calls, `eval`, HTML injection, storage access and external URLs and found none. It adds npm dependencies (`motion`, visx, d3) that are covered by the audit above.
- CSP is unchanged and works with the new components (verified with a production build in headless Chromium; no CSP violations in the console).
