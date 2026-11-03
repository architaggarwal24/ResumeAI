# ResumeAI — Security Audit (63-point checklist)

**Audit date:** 2026-11-03 · **Commit reviewed:** `ef049c3` on `main` (clean worktree, 15 commits total; source tree verified byte-identical to the reviewed copy) · **Method:** read-only source review, grep + data-flow tracing of every API route and SQL migration, git-history secret scan, `npm audit`, local PostgreSQL 16 check of the Supabase migrations. Nothing was run against the deployed site or the Supabase project.

> A previous audit lives in `SECURITY-AUDIT.md` (hyphen). Its fixes are present in this commit and were re-checked, not assumed.

---

## 1. Executive summary

> **Remediation update (2026-11-03):** every approved fix is implemented; see [§7](#7-remediation-status). Once migration 005 is applied and the dashboard settings in §7 are done, the residual risk is **Low**. The tables below describe the code *as audited* at `ef049c3`.

**Overall risk (as audited): Low–Moderate.** No Critical or High issues were found. Authentication, authorization (route checks + row-level security), output escaping, redirect handling and SSRF controls are in good shape. The remaining issues are availability abuse, incomplete account deletion, and controls that live in the Supabase dashboard and can't be verified from code.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 20 |
| Info | 1 |
| Needs manual review | 7 |
| Not found / Not applicable | 34 |

**Top 5 most urgent**
1. **A16 — Any logged-in user can burn database CPU without limit** via the `hash_share_password` RPC (bcrypt cost 12, ~250 ms of database CPU per call, measured locally). PostgREST lets them call it directly, bypassing the app's rate limiter. This degrades the database for everyone. *Medium.*
2. **B2 / B9 — "Delete everything" doesn't delete the account and ignores failure.** The login identity and email stay in `auth.users`, and the app reports success even if the delete failed. *Low.*
3. **C12 / B3 — Database hardening only holds if migrations 002 → 004 are applied in production.** This includes the share lockout, column grants and atomic caps. It can't be confirmed from code. *Manual review.*
4. **A13 / C6 / B1 — Several auth protections are only Supabase dashboard settings:** "Confirm email", minimum password length, leaked-password check, CAPTCHA and MFA. *Low + manual review.*
5. **C20 / B19 / A14 — `script-src 'unsafe-inline'`, plus a session cookie and BYOK keys that page script can read.** Any future XSS bug would be able to steal sessions and API keys. *Low (no XSS found today).*

---

## 2. Findings table

Legend: **V** = Vulnerable · **PM** = Partially mitigated · **NF** = Not found · **NA** = Not applicable · **MR** = Needs manual review

### A. Core application vulnerabilities

| ID | Vulnerability | Status | Severity | Location (file:line) | Evidence | Impact |
|---|---|---|---|---|---|---|
| A1 | XSS | NF | Info | `src/lib/templates/render.ts:12-20`; `src/app/s/[slug]/page.tsx:71,96` | Every field in the HTML templates goes through `esc()`, which escapes `& < > " '`. The public share page re-sanitizes stored data before rendering. Chat output renders as text. No `eval`/`innerHTML` outside vendored code. | None found. Defense-in-depth is weakened by CSP `'unsafe-inline'` (see C20). |
| A2 | CSRF | PM | Low | `src/app/api/resume/[id]/versions/restore/[versionId]/route.ts:34`, `.../versions/[versionId]/route.ts:33`, DELETE routes (`resume/[id]/route.ts:86`, `jobs/[id]/route.ts:81`, `share/route.ts:134`) | Cookie auth with no Origin or `Sec-Fetch-Site` check, and no Content-Type requirement (`src/lib/security/body.ts:10`). Protection rests only on Supabase's default `SameSite=Lax` cookie (`@supabase/ssr` `DEFAULT_COOKIE_OPTIONS`). | A page on a *same-site* origin (another subdomain you control or a compromised one) could trigger restores or deletes. Cross-site attacks are blocked by Lax. |
| A3 | SQL injection | NF | — | `src/app/api/search/route.ts:18-51`, `supabase/migrations/004_atomic_caps.sql:32,40` | Only the Supabase query builder and RPC with bound parameters are used. Search escapes LIKE wildcards and the old `.or()` interpolation is gone. Dynamic SQL in 004 uses `format('%I')` with `USING $1`, and its inputs are trigger arguments, not user data. | — |
| A4 | NoSQL injection | NA | — | — | No MongoDB, Firestore or other document store. | — |
| A5 | Insecure file uploads | NF | — | `src/lib/pdf/extract.ts`, `src/app/(app)/upload/page.tsx` | PDFs are parsed in the browser only (pdf.js bundled, `isEvalSupported:false`, magic-byte and page caps). No server upload endpoint and no storage bucket. | — |
| A6 | Path traversal | NF | — | `src/**` | No `fs`, `path.join` or file APIs in application code. Exports are built in memory. | — |
| A7 | SSRF | NF | — | `src/app/api/linkedin/route.ts:96-118`; `src/lib/llm/server.ts:15-20` | The only user URL: https only, exact LinkedIn host, no credentials or port, `redirect:'manual'`, 15 s timeout, 2 MB cap. LLM hosts are constants. | — |
| A8 | Missing input validation | PM | Low | `src/lib/security/resume-schema.ts`, `body.ts`; `003_security_hardening.sql:206-224` (size checks on `resumes`, `resume_versions`, job URLs, notification hrefs) | API routes validate and cap everything. Clients hold the anon key and a JWT, so they can write their **own** rows straight through PostgREST, skipping app validation. *Correction (during remediation): 003 §7 already caps `resumes.parsed_data/raw_text` and `resume_versions.parsed_data`; the earlier draft of this row missed that.* The other free-text columns (`analyses`, `cover_letters`, `job_applications.notes/company/role/location`, `notifications.title/body`, names/labels) had no DB-side limit. | Self-only data, but it allows storage abuse via those columns. Share and render paths re-sanitize. |
| A9 | Permissive CORS | NF | — | `next.config.ts`, `src/app/api/**` | No `Access-Control-Allow-*` headers are set, so the API is same-origin only. Supabase's own CORS is open by design (auth by key + RLS). | — |
| A10 | IDOR / BOLA | NF | — | `src/lib/security/guards.ts:67-72` (`ownsResume`); every `resume/[id]` and `jobs/[id]` route; RLS in `000/001/003` | Each route filters by `user_id` or checks `ownsResume`, and RLS enforces `auth.uid()` underneath. Locally, the `anon` role read 0 rows from `resumes`, `users` and `resume_shares`. | — |
| A11 | Mass assignment | NF | — | `src/app/api/resume/[id]/route.ts:48-65`; `003_security_hardening.sql:52-60` | API updates are built field-by-field from allowlists. The `users` table only grants UPDATE on `provider, model, display_name`. Other tables allow edits only to the caller's own rows. | — |
| A12 | Weak password reset flow | NA | — | — | The app has no reset flow; Supabase builds reset emails from its Site URL. Reset links built from the Host header were fixed earlier (`src/lib/security/app-origin.ts`). See Manual follow-ups for email templates and redirect allowlist. | — |
| A13 | Account enumeration | PM | Low | `src/lib/security/auth-messages.ts`; login/signup pages | The UI now shows fixed messages. But Supabase Auth endpoints (`/auth/v1/signup`, `/token`) are public; with "Confirm email" OFF, signup returns "User already registered". | Attackers can probe which emails are registered unless the dashboard setting is on. |
| A14 | Weak session management | PM | Low | `node_modules/@supabase/ssr/dist/module/utils/constants.js:1-8` (defaults used by `src/lib/supabase/*.ts`) | Session cookies are `httpOnly:false` (required by the Supabase browser client) with a `maxAge` of 400 days. Session lifetime and inactivity timeout are Supabase settings. | Any script running on the origin can read session tokens (see C20). |
| A15 | Vulnerable JWT | NF | — | `src/lib/supabase/middleware.ts:28`, `guards.ts:28-34` | No custom JWT handling. Every request calls `auth.getUser()`, which validates with the Supabase Auth server (not just decoding). | — |
| A16 | Missing rate limits | **V** | **Medium** | `supabase/migrations/002_secure_share_access.sql:41-50`; `src/lib/security/rate-limit.ts:1-5`; `src/lib/security/guards.ts:57-60` | ① `hash_share_password(text)` is `GRANT EXECUTE … TO authenticated` and runs `crypt(…, gen_salt('bf', 12))`. Locally, 20 calls took 5.0 s. Any account can call it directly via `/rest/v1/rpc/hash_share_password`, with no limit. ② The app limiter lives in memory per instance. ③ `clientIp()` trusts the first `X-Forwarded-For` hop, which clients can set on some hosts. | ① Parallel calls from free accounts can saturate the shared database's CPU, slowing every user. ②③ App-level limits are soft and the per-IP key can be spoofed (the DB-level share lockout remains authoritative). |
| A17 | Frontend-only payment checks | NA | — | — | No payments. `users.tier` can't be written by clients (003:58-60). | — |
| A18 | Open redirect | NF | — | `src/app/auth/callback/route.ts:12`; `src/lib/security/redirect.ts:9-25` | `safeNextPath` allows only same-origin absolute paths (unit-tested). The origin comes from config, not the Host header. Notification links use `safeInternalHref`. | — |
| A19 | Unverified webhook signatures | NA | — | — | No webhook endpoints (searched `src/app/api/**` and the routes list). | — |

### B. Advanced, supply chain and AI

| ID | Vulnerability | Status | Severity | Location (file:line) | Evidence | Impact |
|---|---|---|---|---|---|---|
| B1 | Missing MFA | V | Low | `src/app/(auth)/*`; no `auth.mfa` usage anywhere | No MFA enrolment or AAL2 check. Supabase supports TOTP, but it isn't wired up. | A stolen or reused password is enough to take over an account (resume PII, share links). |
| B2 | Business logic flaws | V | Low | `src/app/(app)/settings/page.tsx:95-103` | "Delete all data" runs `from('users').delete()`. That cascades app data, but **`auth.users` (login and email) is kept** and the user can sign in again. The result isn't checked. Also: anyone who has a slug can trigger that share's 10-attempt lockout (by design, documented); anonymous calls inflate `view_count` (003:192, Info). | The privacy promise ("Can I delete everything?") isn't met, and a silent failure is reported as success. |
| B3 | Race conditions | PM | Low | `supabase/migrations/004_atomic_caps.sql`; `003:100-200` (share lockout uses an advisory lock); `003:62-77` (atomic counter) | Caps are atomic only after migration 004 is applied (verified locally: 40 parallel inserts stopped at exactly 25). No one-time codes or balances exist. | Until 004 is applied in production, per-user caps can be exceeded with parallel or direct PostgREST inserts. |
| B4 | Webhook replay | NA | — | — | No webhooks. | — |
| B5 | Insecure CI/CD permissions | NA | — | repo root | No `.github/workflows` or other CI config in the repo. Netlify/Vercel build from their dashboards. | — |
| B6 | Exposed deployment credentials | NF | — | `netlify.toml`, git history | No tokens in config or history. | — |
| B7 | Untrusted GitHub Actions | NA | — | — | No Actions. | — |
| B8 | Unpinned build dependencies | PM | Low | `package.json` (caret ranges), `netlify.toml:6` (`NODE_VERSION = "20"`) | `package-lock.json` is committed, so installs are reproducible. Node is pinned only to the major version. *Added during remediation:* Node 20 reached end-of-life in April 2026, so production builds were on an unsupported runtime. | A new Node 20 minor could change the build, and an EOL runtime gets no security patches. Low. |
| B9 | Fail-open security checks | V | Low | `src/app/(app)/settings/page.tsx:100-102` | The account-deletion error is ignored, then the user is signed out and sent to `/signup` as if it worked. Other gates fail closed: `getAuthedUser` returns null on error, `isEmailVerified` returns false, `appOrigin` throws in production, `ownsResume` returns false. | The user believes their data is gone when it may not be. |
| B10 | Missing request timeouts | PM | Low | `src/lib/llm/server.ts:297` | Streaming chat passes only the client's abort signal (no server timeout). Every other outbound fetch has one: `server.ts:42-44` (60 s), `linkedin/route.ts:115` (15 s), `test-connection/route.ts:28,50,80`. | A stalled provider stream holds a function until the platform's 60 s `maxDuration`. Bounded, low. |
| B11 | Unsecured GraphQL | MR | — | Supabase project | The app doesn't use GraphQL, but Supabase enables `pg_graphql` (`/graphql/v1`) by default, governed by the same RLS. | Extra attack surface if RLS ever regresses. Disable it if unused. |
| B12 | Unsecured WebSocket | NF | — | `next.config.ts:31` (`wss://` in CSP) | No Realtime subscriptions in code, and no tables added to `supabase_realtime` in the migrations. | — |
| B13 | Exposed legacy API versions | NF | — | `src/app/api/**`; `src/lib/llm/ollama-guard.ts` | No versioned or legacy routes. `ollama-guard.ts` is dead code (not imported). `/api/llm` is an authenticated, rate-limited relay to fixed hosts that only works with the caller's own key. | — |
| B14 | AI prompt injection | PM | Low | `src/app/api/analyze/route.ts:214,238,277,302`; `src/app/api/chat/route.ts:43-55` | Untrusted job-post and resume text go straight into prompts without delimiting. Mitigations: model output is validated and sanitized before storage (`resume-schema.ts`), there are no tools, chat edits apply only when the user clicks Apply, and `system` turns can't be injected (`chat/route.ts:43`). | A hostile job post can steer suggestions for that user only, for example proposing a misleading bullet. No cross-user effect. |
| B15 | AI data leakage | NF | — | `src/lib/llm/server.ts`, `src/lib/llm/prompts.ts` | Prompts contain only the caller's own resume and job post. API keys go in headers, never in prompts. Prompts aren't logged. | — |
| B16 | Unsafe execution of AI output | NF | — | `src/lib/llm/parse.ts`; `src/lib/templates/latex.ts` (`texEscape`) | AI output is only parsed as JSON, sanitized, rendered escaped, or LaTeX-escaped. Never `eval`'d or executed. | — |
| B17 | Overprivileged AI agents | NA | — | — | No tool or function calling. The model can't act. | — |
| B18 | Unbounded AI consumption | PM | Low | `guards.ts:9-17`; `server.ts:105` (token clamp); `MAX_BODY` | Per-user limits, an output-token clamp, body caps, and BYOK (the attacker pays their own provider). Limits are per instance (see A16). | Server function time is bounded, but limits are soft on serverless. |
| B19 | Sensitive data in local storage | PM | Low | `src/store/resumeStore.ts:11-23` | BYOK API keys are kept in `sessionStorage` by design (never in the DB). Any script running on the origin can read them. `localStorage` holds only UI preferences. | Combined with any future XSS, users' AI keys could be stolen (see C20). |
| B20 | Cross-tenant leakage in AI retrieval | NA | — | — | No RAG, vector store or shared retrieval. Context is the caller's own resume. | — |

### C. Secrets, access control and configuration

| ID | Vulnerability | Status | Severity | Location (file:line) | Evidence | Impact |
|---|---|---|---|---|---|---|
| C1 | Exposed database credentials | NF | — | repo + history | No connection strings or DB passwords. The app uses only the Supabase URL and anon key. | — |
| C2 | Publicly exposed `.env` | NF | — | `.gitignore:2-3` | The local `.env` is ignored and was never committed (checked full history). It holds only `NEXT_PUBLIC_*` values. Next doesn't serve the repo root. | — |
| C3 | Hard-coded API keys / secrets | NF | — | `tests/security/llm-validate.test.mjs:5` | The only key-shaped string is a test placeholder (`AIzaSyExam****`), a fake value. | — |
| C4 | Secrets in git history | NF | — | all 15 commits, all branches | Scanned the full history for Anthropic/OpenAI/Gemini/NVIDIA/OpenRouter/GitHub/Slack/AWS key shapes, JWTs, private keys, Postgres URLs and Supabase project URLs. Only the placeholder above matched. Deleted files: `README.MD`, `BYOKPanel.tsx`, `tsconfig.tsbuildinfo` (no secrets). Repo hygiene note: `Claude outputs/` (zips and screenshots) and `.idea/workspace.xml` are committed. Not secret, but they add noise to the public repo. | — |
| C5 | Secrets in frontend JS | NF | — | `src/lib/supabase/client.ts` | The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `ANON_KEY` (public by design). No service-role key anywhere. | — |
| C6 | Weak authentication | PM | Low | `src/app/(auth)/signup/page.tsx:27,79` | The 8-character minimum is enforced in the browser only. The server-side minimum, leaked-password check and CAPTCHA are Supabase settings (default minimum is 6). | Weak or breached passwords can be set via the Auth API directly. |
| C7 | Missing server-side authorization | NF | — | all 22 route files; `src/lib/supabase/require-user.ts` | Every handler except the intentionally public share-unlock checks the user and returns 401 (confirmed: `/api/resume` and `/api/analytics` returned 401 when logged out). Pages call `requireUser()`. Unconfirmed emails are treated as logged out. | — |
| C8 | Unprotected admin routes | NA | — | — | No admin routes or roles. | — |
| C9 | Overprivileged DB accounts | PM | Low | `002:50` | The app never uses the service role. SECURITY DEFINER functions pin `search_path` and key on `auth.uid()`. The one overly broad grant is `hash_share_password` to `authenticated` (see A16). | See A16. |
| C10 | Public databases / backups | MR | — | Supabase project | Direct Postgres ports, network restrictions, SSL enforcement and backup / point-in-time recovery are dashboard settings. | Unknown from code. |
| C11 | Misconfigured Firebase | NA | — | — | No Firebase. | — |
| C12 | Misconfigured Supabase (RLS / service role) | MR | — | `supabase/migrations/000-004` | RLS is enabled on all 9 tables with owner-scoped policies and WITH CHECK on resume ownership. No `USING (true)` policies remain. No service role in the client. Requires: migrations 002, 003 and 004 actually applied in production, with no extra policies added in the dashboard. | If 002/003 weren't applied, share hashes are public and cross-tenant share inserts work. |
| C13 | Public storage buckets | MR | — | Supabase project | The code uses no buckets. Any bucket created in the dashboard must be private. | — |
| C14 | Unchanged default credentials | MR | — | Supabase project | None in code. The database password and dashboard accounts need checking. | — |
| C15 | Exposed staging environments | MR | — | Netlify/Vercel | Deploy previews are public by default and use the **production** Supabase project (single `.env`). | Preview builds of unreleased code run against production data. |
| C16 | Production debug tools | NF | — | `next.config.ts` | No debug endpoints or flags. `test-connection` requires login and is rate-limited. | — |
| C17 | Secrets in build logs | NF | — | `netlify.toml` | The build has no secrets: only `NEXT_PUBLIC_*` values (public anyway). Nothing echoes env. | — |
| C18 | Stack traces in error responses | NF | — | `src/app/api/**` | Every catch returns a generic message. `err.message` is returned only for the typed `LLMError`, which carries app-written or provider-status text (e.g. `analyze/route.ts:321`, `server.ts:320,339,358`). | — |
| C19 | Sensitive data in logs | PM | Low | `src/app/api/analyze/route.ts:182`; `src/app/api/analytics/route.ts:90`; `src/lib/llm/server.ts:204` | Logs the whole error object (provider error text or Supabase error details) instead of name/code only, unlike the rest of the codebase. No keys are logged. Provider messages may echo request details. | Minor: provider or DB error text ends up in platform logs. |
| C20 | Missing security headers | PM | Low | `next.config.ts:19-48` | CSP, HSTS (production), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and COOP are all present. Gap: `script-src 'self' 'unsafe-inline'`. | A future HTML-injection bug could run inline script and read session cookies and BYOK keys (A14, B19). |
| C21 | Insecure transmission / storage | NF | — | `next.config.ts:38,48`; `002:41-47` | `upgrade-insecure-requests` + HSTS. All third parties use HTTPS. Share passwords are bcrypt-hashed. API keys aren't stored. Encryption at rest is a Supabase platform property. | — |
| C22 | Exposed source maps | NF | — | `next.config.ts`; build output | `productionBrowserSourceMaps` isn't set and the production build contains 0 `.map` files under `.next/static`. `package.json` is `"private": true`. | — |
| C23 | Vulnerable / outdated dependencies | PM | Low | `package-lock.json` | `npm audit --omit=dev`: **0** vulnerabilities. Full audit: **15 moderate, all dev-only** (the `minimatch` < 11.0.1 ReDoS reached through `eslint`/`typescript-eslint`/`eslint-config-next`). Outdated within range: `next` 16.4.3→16.4.4, `@supabase/supabase-js` 2.106→2.118, `pdfjs-dist` 6.3→6.5, `docx` 9.7→9.15. | Dev tooling only; no runtime exposure. Keep patch levels current. |
| C24 | Missing security monitoring | V | Low | — | No error tracking, alerting or audit log of security events (failed logins, share lockouts, 429s). Only `console.error` to platform logs. | Abuse such as A16 or brute force would go unnoticed. |

---

## 3. Detailed findings

### A16 — Unlimited bcrypt RPC lets any account exhaust database CPU (Medium, Vulnerable)

```sql
-- supabase/migrations/002_secure_share_access.sql:41-50
CREATE OR REPLACE FUNCTION public.hash_share_password(p_password text)
RETURNS text LANGUAGE sql SET search_path = public, extensions, pg_temp
AS $$ SELECT crypt(p_password, gen_salt('bf', 12)); $$;
REVOKE ALL ON FUNCTION public.hash_share_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hash_share_password(text) TO authenticated;
```
**Scenario:** an attacker signs up for a free account (or several). They take the anon key from the site's JavaScript and their own access token from their session cookie. Then they fire parallel `POST /rest/v1/rpc/hash_share_password` requests. Each one costs about 250 ms of database CPU; 20 sequential calls took 5.03 s on a local PostgreSQL 16. The app's 20-per-hour share limiter (`guards.ts:15`) never sees these calls, because they go straight to PostgREST.
**Why exploitable:** the function only exists so `/api/share` can hash a password before inserting. Exposing it to every authenticated user gives them a free CPU-heavy primitive on the shared database.
**Related:** `clientIp()` (`guards.ts:57-60`) takes the first `X-Forwarded-For` value. On hosts that append rather than overwrite it, a client can rotate that value to dodge per-IP limits. The DB-level share lockout (003) is per slug and still holds.

### A2 — State-changing routes rely only on SameSite=Lax (Low, Partially mitigated)
Bodyless POST and DELETE routes (`restore/[versionId]/route.ts:34`, `resume/[id]/route.ts:86`, …) accept any Content-Type and don't check Origin. Browsers don't send Lax cookies on cross-*site* POSTs, so ordinary CSRF fails. But a same-*site* page (e.g. `blog.yourdomain.com`, or a hijacked subdomain; see DNS checks) counts as same-site and would carry the cookie. **Scenario:** an attacker-controlled subdomain auto-submits `<form method=POST action="https://app…/api/resume/<id>/versions/restore/<vid>">`, and the victim's resume is overwritten with an old version (a pre-restore snapshot is kept).

### A8 — PostgREST bypasses API validation for the user's own rows (Low)
The API caps resume bodies at 512 KB and sanitizes `parsed_data`. The same user can write `/rest/v1/*` directly with their JWT; RLS limits them to their own rows. Migration 003 (§7, lines 206-224) already has DB-side size checks for resumes and versions. **Correction:** the first draft of this report said there were none; that was wrong. The gap is the remaining text columns (`analyses.job_description/result`, `cover_letters.*`, `job_applications.notes/company/role/location`, `notifications.title/body/type`, `resumes.name`, `resume_versions.label`, `users` preference strings). **Scenario:** a user stores very large `cover_letters.content` or `job_applications.notes` values up to the row caps, inflating storage and egress. Render paths re-sanitize, so it causes no XSS.

### A13 / C6 / B1 — Auth hardening depends on dashboard settings (Low)
The UI messages no longer reveal whether an email has an account (`auth-messages.ts`), but the Supabase Auth API is public. With "Confirm email" OFF, `POST /auth/v1/signup` answers "User already registered". The 8-character minimum exists only in the browser. There's no MFA, so a reused or leaked password means account takeover.

### A14 / B19 / C20 — Script-readable session and keys plus `'unsafe-inline'` (Low)
Supabase SSR cookies are `httpOnly:false` and last 400 days. BYOK keys sit in `sessionStorage`. The CSP allows inline script (`next.config.ts:28`). No XSS sink was found, but any future injection would be able to exfiltrate the session token and the user's provider key. A nonce-based CSP would turn such a bug into a blocked script.

### B2 / B9 — Account deletion is incomplete and fails open (Low)
```ts
// src/app/(app)/settings/page.tsx:100-102
await supabase.from('users').delete().eq('id', user.id)   // result ignored
await supabase.auth.signOut()
router.push('/signup')
```
`auth.users` (email, password hash, identities) is left behind, and the user can sign back in. If the delete fails (RLS, network), the user is still told it worked. This contradicts the landing-page FAQ ("Can I delete everything? Yes").

### B3 — Caps are atomic only once migration 004 is live (Low)
The code is fixed (004 triggers with a per-owner advisory lock; locally 40 parallel inserts stopped at 25). Until the migration runs in production, parallel or direct PostgREST inserts can exceed the 200/1000/100/25 caps.

### B8 — Node pinned to major only (Low)
`NODE_VERSION = "20"` floats across minors; the lockfile pins packages.

### B10 — Streaming chat has no server-side timeout (Low)
`streamLLMText` (`server.ts:297`) passes only `input.signal`, the client's abort. A provider that stalls mid-stream keeps the function alive until the platform's 60 s `maxDuration`.

### B14 — Untrusted job-post text is not delimited in prompts (Low)
Job descriptions are concatenated as `Job Description:\n${…}` (`analyze/route.ts:214`). A hostile posting can contain instructions. The impact is confined to that user's suggestions because there are no tools, outputs are sanitized, and edits are user-approved.

### B18 — AI limits are per instance (Low)
See A16 ②. BYOK means the attacker pays their provider, so the exposure is server time only.

### C19 — Two log lines print full error objects (Low)
`analyze/route.ts:182` logs `enrichErr` and `analytics/route.ts:90` logs `err`. Everywhere else, only the name or code is logged.

### C23 — Dev-only moderate advisories (Low)
Run `npm audit` and see the 15 `minimatch` ReDoS advisories through the eslint toolchain. There's no production exposure.

### C24 — No security monitoring (Low)
Nothing alerts on spikes of 401, 429 or 5xx responses, share lockouts, or DB CPU.

---

## 4. Not applicable / not found — what was checked

- **A1:** greps for `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` and `href={` in `src/`. Traced all 4 HTML render sinks to `esc()` and `sanitizeResumeData`.
- **A3:** every `.from()`, `.rpc()`, `.or()`, `.ilike()` and `EXECUTE` in `src/` and `supabase/`.
- **A4:** no NoSQL client in `package.json`.
- **A5:** no `formData()` or multipart handling in `src/app/api`. PDF handling is browser-only.
- **A6:** no `fs`, `path` or file APIs in `src/` (vendored code excluded and also checked).
- **A7:** all `fetch(` calls in `src/app/api` and `src/lib/llm`: fixed hosts, or the LinkedIn allowlist.
- **A9:** no CORS headers in `next.config.ts` or any route.
- **A10:** read all 22 route files for `user_id` filters and `ownsResume`. Ran RLS locally as `anon`.
- **A11:** reviewed every `.update()` and `.insert()` payload construction, plus the column grants in 003.
- **A12, A17, A19, B4, B5, B7, B17, B20, C8, C11:** the feature doesn't exist (no reset UI, payments, webhooks, CI, agents/tools, retrieval, admin or Firebase).
- **A15:** no `jsonwebtoken`, `jose` or manual JWT parsing. `getUser()` used throughout.
- **A18:** all `redirect()` and `router.push()` calls take constant or validated paths.
- **B6, C1–C5:** full-history scan (patterns listed in C4). Checked `.env` is ignored and was never added. Checked `netlify.toml`.
- **B12:** no `.channel(` or `realtime` usage. No publication changes in the migrations.
- **B13:** route inventory; dead `ollama-guard.ts` noted.
- **B15, B16:** read `prompts.ts`, `server.ts` and `parse.ts`: no secrets in prompts, no execution of output.
- **C7:** route inventory and auth checks (22 files). Local requests returned 401 when logged out.
- **C16, C17:** `next.config.ts` and `netlify.toml`.
- **C18:** every `NextResponse.json(... err...)`.
- **C21:** CSP and HSTS directives; password hashing in 002.
- **C22:** `next.config.ts` and a `find .next/static -name '*.map'` count of 0.

---

## 5. Manual follow-ups (can't be verified from code)

| Area | Where | What to check |
|---|---|---|
| Migrations applied (C12, B3) | Supabase → SQL editor / Database → Migrations | Confirm 002, 003 and 004 ran. `select policyname from pg_policies where tablename='resume_shares'` should **not** list `shares_public_read`. `select tgname from pg_trigger where tgname like 'cap_%'` should return 4 rows. |
| Security Advisor (C12) | Supabase → Advisors | No "RLS disabled", "policy always true" or "function search_path mutable" warnings. |
| Auth settings (A13, C6, B1, A14) | Supabase → Authentication | Confirm email **ON**; minimum password length ≥ 8 with character requirements; leaked-password protection ON; CAPTCHA ON; MFA (TOTP) enabled once B1 ships; session time-box and inactivity timeout; rate limits for sign-in, sign-up and emails. |
| Redirect allowlist (A12, A18) | Supabase → Auth → URL Configuration | Site URL = production; Redirect URLs list only exact production and localhost callbacks, with no `**` wildcards. Check the reset and confirm email templates use `{{ .SiteURL }}`. |
| GraphQL (B11) | Supabase → Database → Extensions | Disable `pg_graphql` if unused. |
| Database exposure and backups (C10, C14) | Supabase → Database → Settings / Backups | Enforce SSL; network restrictions; strong DB password; daily backups or point-in-time recovery on; perform one test restore. |
| Storage (C13) | Supabase → Storage | No buckets, or all private. |
| Staging (C15) | Netlify / Vercel | Password-protect deploy previews, or point previews at a separate Supabase project. |
| `.env` over HTTP (C2) | Browser | `https://<domain>/.env` and `/.git/config` return 404. |
| Host IP header (A16) | Netlify / Vercel docs | Confirm which header carries the real client IP on your host (Netlify: `x-nf-client-connection-ip`). |
| Monitoring (C24) | Supabase → Reports; host dashboard | Alerts on database CPU, Auth error rates and 5xx spikes. |
| Credential rotation | — | **No leaked secrets were found, so rotation isn't required.** If a service-role key or DB password was ever pasted into chat, CI or a ticket, rotate it anyway. |

---

## 6. Remediation plan

No secrets were found in code or history, so there's nothing to rotate or purge. `.env*.local` and `.env` are already ignored; the plan adds `.env*` with an `!.env.example` exception for completeness.

### Quick wins

| # | Finding | Proposed fix | Files | New deps | Breaking-change risk | Verify |
|---|---|---|---|---|---|---|
| Q1 | **A16 / C9 (Medium)** | New migration `005_share_create_rpc.sql`: a SECURITY DEFINER `create_share(p_resume_id, p_password, p_expires_at)` that checks `auth.uid()` owns the resume, throttles to 20 creations per user per hour using a DB-side table, generates the slug server-side, hashes and inserts. `REVOKE EXECUTE ON hash_share_password FROM authenticated`. `/api/share` POST calls the new RPC. | `supabase/migrations/005_*.sql`, `src/app/api/share/route.ts`, `tests/security/migrations.test.mjs` | none | **Deploy order:** run 005 before deploying the new route. The old route stops working once the grant is revoked. | Local Postgres: the `authenticated` role gets `permission denied` on `hash_share_password`; the 21st `create_share` within an hour fails; creating a share on another user's resume fails. Unit test for the route's error mapping. |
| Q2 | **A16 ③** | `clientIp()` prefers platform-set headers (`x-nf-client-connection-ip`, then `x-real-ip`) before falling back to `X-Forwarded-For`. | `src/lib/security/guards.ts` → extract to `src/lib/security/client-ip.ts` | none | none | Unit test: a spoofed `X-Forwarded-For` is ignored when a platform header is present. |
| Q3 | **B2 / B9** | Migration adds `delete_my_account()` (SECURITY DEFINER, deletes `auth.users WHERE id = auth.uid()`, which cascades the app data). New `POST /api/account/delete` route (auth plus Origin check) calls it and checks the result. Settings shows an error if it fails. | `supabase/migrations/005_*.sql`, `src/app/api/account/delete/route.ts`, `src/app/(app)/settings/page.tsx` | none | Behaviour change: deletion is now complete and irreversible. Needs 005 applied. | Local Postgres: the function deletes only the caller, and cascades. Unit test: the route returns 401 when logged out and 500 is shown when the RPC errors. |
| Q4 | **A2** | Same-origin check for API writes in `src/proxy.ts`: reject `POST/PUT/PATCH/DELETE` to `/api/*` (except `/api/share/unlock`) with 403 when `Sec-Fetch-Site` is `cross-site` or `same-site`, or when `Origin` is present and isn't the app origin. A pure helper with tests. | `src/lib/security/same-origin.ts`, `src/proxy.ts`, tests | none | Low. Only browsers on other origins are affected; same-origin fetches send `Sec-Fetch-Site: same-origin`. | Unit tests over a header matrix; a local `curl` with `Origin: https://evil.example` returns 403. |
| Q5 | **B10** | Add `AbortSignal.timeout(60_000)` to `streamLLMText`, combined with the client signal. | `src/lib/llm/server.ts` | none | none | Typecheck plus a unit test of the signal helper. |
| Q6 | **C19** | Log only `name`/`code` at `analyze/route.ts:182` and `analytics/route.ts:90`. | those 2 files | none | none | grep test: no `console.error(..., err)` with a raw object in `src/app/api`. |
| Q7 | **A8** | Migration adds `NOT VALID` CHECK constraints to the text/JSON columns that 003 didn't cover (see corrected A8). | `supabase/migrations/005_*.sql` | none | Rejects oversize direct writes only; API limits are below these values. | Local Postgres: an oversized insert as `authenticated` fails. |
| Q8 | **B14** | Wrap untrusted job-post and resume text in labelled delimiters with a "treat as data, not instructions" line in the system prompts. | `src/lib/llm/prompts.ts`, the routes building prompts | none | Slight change to prompt wording. | Unit test of the wrapper; existing parse tests still pass. |
| Q9 | **B8**, repo hygiene | Pin `NODE_VERSION = "20.19"` in `netlify.toml`. Add `Claude outputs/`, `.idea/` and `.env*` (`!.env.example`) to `.gitignore`, and untrack them (`git rm -r --cached "Claude outputs" .idea`). Not secrets, so no history rewrite is needed. | `netlify.toml`, `.gitignore` | none | none | `git status` shows them untracked; the build runs. |
| Q10 | **C23** | `npm update next @supabase/supabase-js pdfjs-dist docx` (within the existing ranges). The dev `minimatch` advisory: `npm audit fix` if it resolves without major bumps, otherwise accept (dev-only). | `package-lock.json` | updates only | Low (patch/minor). | `npm audit --omit=dev` shows 0; tests, lint and build pass. **Needs network on your machine; I'll ask before running it.** |

### Larger changes (I recommend doing them, but each needs your OK)

| # | Finding | Proposed fix | Files | New deps | Risk | Verify |
|---|---|---|---|---|---|---|
| L1 | **C20 / A14 / B19** | Nonce-based CSP: generate a nonce in `proxy.ts`, set `script-src 'self' 'nonce-…' 'strict-dynamic'`, drop `'unsafe-inline'` for scripts (styles keep it, because the templates use inline style attributes). | `src/proxy.ts`, `next.config.ts`, `src/app/layout.tsx` | none | **Medium:** every page becomes dynamically rendered and inline scripts must carry the nonce. Needs a careful smoke test. | Build plus headless check: no CSP violations, and an injected inline `<script>` is blocked. |
| L2 | **B1** | Optional TOTP MFA: enrol and verify screens in Settings, an AAL2 challenge after login, and `requireUser()` requires AAL2 when a factor exists. | new `src/app/(app)/settings/mfa`, `require-user.ts`, login flow | none (supabase-js has `auth.mfa`) | Medium (new flow) | Unit tests for the AAL gate; manual enrol test against a dev project. |
| L3 | **A16 ② / B18** | Shared rate limiting (Upstash Redis or a Postgres table with an atomic upsert) instead of in-memory. | `src/lib/security/rate-limit.ts`, guards | `@upstash/ratelimit` *or* none (Postgres) | Medium; adds a dependency or DB load | Tests: the limit holds across two simulated instances. |
| L4 | **C24** | Error and security monitoring (e.g. Sentry) plus Supabase and host alerts. | config + `instrumentation.ts` | `@sentry/nextjs` | Low; adds a vendor and CSP `connect-src` | Test event reaches the dashboard. |

### Manual actions (yours)

Everything in section 5. The most important are: apply migrations 004 and 005, turn on Confirm email, leaked-password protection and CAPTCHA, disable `pg_graphql` if unused, and protect deploy previews.

**Suggested order:** Q1 → Q3 → Q4 → Q2 → Q5 → Q6 → Q7 → Q8 → Q9 → Q10, then L1–L4 if approved.

---


## 7. Remediation status

**Updated 2026-11-03.** You approved every item (Q1–Q10, L1–L4), and all are implemented. Each step was checked with `npm test` (147/147 pass), `tsc --noEmit` (clean), `eslint` (36 problems, the same pre-existing baseline in vendored files, 0 new) and `next build` (passes). The SQL was run against a local PostgreSQL 16 with a Supabase shim (`tests/sql/`). The nonce CSP and same-origin check were exercised on a production build (`next start`) with headless Chromium and curl. Nothing was run against your Supabase project or the deployed site.

> **⚠ Deploy order:** apply `supabase/migrations/005_security_remediation.sql` in the Supabase SQL editor **before** deploying this code. Share creation and account deletion call functions that only exist after 005. Rate limiting falls back to in-memory without it.

### Status by finding

| ID | Status | What changed | Files | Verified by |
|---|---|---|---|---|
| **A16 ①**, C9 | **Fixed** *(needs 005 applied)* | `hash_share_password` is no longer executable by `anon`/`authenticated`. A new `create_share()` does the following in one step: ownership check → 20/hour per-user throttle → 25-per-resume cap → server-side slug → bcrypt. Throttle and cap run **before** hashing. Failed calls roll back their throttle hit, so a hash followed by a failing insert would otherwise be unthrottled. | [005](supabase/migrations/005_security_remediation.sql) §2, [share/route.ts](src/app/api/share/route.ts), [db-errors.ts](src/lib/security/db-errors.ts) | `tests/sql/005_*.test.sql`: permission denied on the hash fn (both roles); another user's resume → `not_found`; 21st share in an hour → `rate_limited`; cap hit returns in 0.8 ms (no bcrypt). `db-errors.test.mjs`, `migrations.test.mjs`, `remediation-wiring.test.mjs`. |
| **A16 ③** | **Fixed** | `clientIp()` prefers `x-nf-client-connection-ip` (Netlify), then `x-real-ip`, then the first `X-Forwarded-For` hop. Values that aren't IP-shaped are ignored. | [client-ip.ts](src/lib/security/client-ip.ts), [guards.ts](src/lib/security/guards.ts) | `client-ip.test.mjs` |
| **A16 ②**, B18 (L3) | **Fixed** *(needs 005 applied)* | Shared, database-backed per-user limiter `rate_limit_hit(bucket)`. Limits live in SQL, so callers can't pass their own. There's one row per user and bucket, and the upsert is atomic. `limitUser()` checks the in-memory brake first, then the shared counter, in all 18 per-user call sites. If the shared store is unavailable, the in-memory limit stands. | [005](supabase/migrations/005_security_remediation.sql) §1, [shared-rate-limit.ts](src/lib/security/shared-rate-limit.ts), [guards.ts](src/lib/security/guards.ts), `src/app/api/**/route.ts` | SQL: 6 allowed then blocked; unknown bucket rejected; table not readable; anon denied. `shared-rate-limit.test.mjs` (incl. app buckets ⇔ SQL buckets). |
| **B2 / B9** | **Fixed** *(needs 005 applied)* | `delete_my_account()` deletes the caller's `auth.users` row, and every table cascades. A new `POST /api/account/delete` requires `{"confirm":"DELETE"}` and returns `deleted:true` only when the DB confirms. Settings shows the error and keeps you signed in if it fails. | [005](supabase/migrations/005_security_remediation.sql) §3, [account/delete/route.ts](src/app/api/account/delete/route.ts), [settings/page.tsx](src/app/(app)/settings/page.tsx) | SQL: login, profile, resumes, shares and rate-limit rows gone, the other user untouched, a second call returns `false`. Route returns 401 without auth (curl). `remediation-wiring.test.mjs`. |
| **A2** | **Fixed** | `src/proxy.ts` rejects `POST/PUT/PATCH/DELETE` to `/api/*` with 403 when `Sec-Fetch-Site` isn't `same-origin`/`none`, or (no `Sec-Fetch-Site`) when `Origin` isn't ours. *Deviation from plan:* `/api/share/unlock` is **not** exempted, because the share page calls it from our own origin. | [same-origin.ts](src/lib/security/same-origin.ts), [proxy.ts](src/proxy.ts) | `same-origin.test.mjs`. curl on a prod build: cross-site 403, same-site subdomain 403, foreign Origin 403, same-origin → 401 (normal auth), no headers → 401. |
| **B10** | **Fixed** | Streaming chat has a 55 s server deadline combined with the client's abort. | [timeouts.ts](src/lib/llm/timeouts.ts), [server.ts](src/lib/llm/server.ts) | `timeouts.test.mjs` |
| **C19** | **Fixed** | The three log lines now print only an error name or code. | [analyze/route.ts](src/app/api/analyze/route.ts), [analytics/route.ts](src/app/api/analytics/route.ts), [server.ts](src/lib/llm/server.ts) | `remediation-wiring.test.mjs` (no raw error objects logged in `src/app/api`) |
| **A8** | **Fixed** *(needs 005 applied)* | `NOT VALID` size checks on the remaining text and JSON columns (see corrected A8). | [005](supabase/migrations/005_security_remediation.sql) §4 | SQL: oversized `job_applications.notes` and `cover_letters.content` rejected; normal insert OK. |
| **B14** | **Partially fixed** | Job posts and LinkedIn text are wrapped in `<untrusted_…>` tags, which can't be closed early, and every system prompt says to treat them as data. Prompt injection can't be fully eliminated; the existing output validation and user-approved edits remain the backstop. | [untrusted.ts](src/lib/llm/untrusted.ts), [server.ts](src/lib/llm/server.ts), analyze / cover-letter / tailor / interview / linkedin routes | `untrusted.test.mjs`, `remediation-wiring.test.mjs` |
| **B8** | **Fixed** | `NODE_VERSION = "22.23.4"` (exact; Node 20 is EOL). This is the version the project is developed and tested on. | [netlify.toml](netlify.toml) | Tests and build pass on Node 22.23.4 |
| Repo hygiene (C4 note) | **Requires manual action** | `.gitignore` now ignores `.idea/`, `Claude outputs/` and `.env*` (keeping `.env.example`). Files that are already committed stay tracked until you untrack them (command below). | [.gitignore](.gitignore) | `git check-ignore` |
| **C23** | **Partially fixed** | `next` 16.4.3→16.4.4, `@supabase/supabase-js` →2.118.0, `pdfjs-dist` →6.5.438, `docx` →9.15.1 (all within existing ranges; `package.json` unchanged). `npm audit --omit=dev`: 0. The 15 moderate dev-only `minimatch` advisories remain: `npm audit fix` didn't clear them without a breaking ESLint major bump, so they're accepted (dev tooling only). | [package-lock.json](package-lock.json) | `npm audit`; tests and build pass |
| **C20**, A14, B19 (L1) | **Fixed** (scripts) / **Partially fixed** (A14, B19) | Per-request nonce CSP: `script-src 'self' 'nonce-…' 'strict-dynamic'`, with no `'unsafe-inline'` for scripts. APIs get `default-src 'none'`. The root layout renders per request so every page carries the nonce. `style-src` keeps `'unsafe-inline'` (template style attributes). Session cookies stay script-readable, which `@supabase/ssr` requires, and BYOK keys stay in `sessionStorage`. The CSP now stops injected script from reaching them. | [csp.ts](src/lib/security/csp.ts), [proxy.ts](src/proxy.ts), [next.config.ts](next.config.ts), [layout.tsx](src/app/layout.tsx) | `csp.test.mjs`. Prod build: header nonce matches all 18 script tags. 0 CSP violations and hydration OK on `/`, `/login`, `/signup`, `/mfa`, `/s/…`, `/dashboard`. An injected `<img onerror>` was **blocked** (CSP violation logged). |
| **B1** (L2) | **Fixed in code** — *requires manual action to switch on* | Optional TOTP: enrol / verify / turn off in Settings, and a `/mfa` code step after sign-in. Enrolled users are treated as signed out at aal1 by the middleware, `requireUser()` and `getAuthedUser()`. The database enforces the same rule with RESTRICTIVE RLS policies on all 8 user tables and inside the new functions. | [mfa.ts](src/lib/security/mfa.ts), [TwoFactorCard.tsx](src/components/settings/TwoFactorCard.tsx), [mfa/page.tsx](src/app/(auth)/mfa/page.tsx), [middleware.ts](src/lib/supabase/middleware.ts), [require-user.ts](src/lib/supabase/require-user.ts), [guards.ts](src/lib/security/guards.ts), [005](supabase/migrations/005_security_remediation.sql) §0, §5 | `mfa.test.mjs`. SQL: an enrolled user sees 0 rows at aal1 and 1 at aal2, insert at aal1 blocked, other users unaffected, delete at aal1 → `mfa_required`. **Not tested end-to-end against real Supabase Auth** (needs your project). |
| **C24** (L4) | **Partially fixed** | Structured `security_event` JSON log lines for: cross-origin blocks, rate limits, share throttles and lockouts, account deletions and failures, and every uncaught server error (`src/instrumentation.ts`, with no message text, headers or query strings). Optional `SECURITY_ALERT_WEBHOOK_URL` (server env) posts alert-level events. Sentry wasn't added: it needs a vendor account and a new dependency. | [security-log.ts](src/lib/security/security-log.ts), [instrumentation.ts](src/instrumentation.ts) | `security-log.test.mjs` (sensitive keys dropped); events seen in the prod-build log |
| B3, C12 | **Requires manual action** | Apply migrations 004 **and** 005 in production, then run the checks in §5. | — | — |
| A13, C6, B11, C10, C13, C14, C15 | **Requires manual action** | Dashboard and hosting settings: see §5 and the list below. | — | — |

### Your manual actions, in order

1. **Supabase → SQL editor:** run `005_security_remediation.sql` (and 004 if it isn't applied yet). Then check:
   - `select has_function_privilege('authenticated', 'public.hash_share_password(text)', 'execute');` → **false**
   - `select proname from pg_proc where proname in ('create_share','delete_my_account','rate_limit_hit','session_meets_mfa');` → 4 rows
   - `select count(*) from pg_policies where policyname = 'mfa_required';` → 8
2. **Deploy** this code (after step 1).
3. **Smoke test with a throwaway account:**
   - Create a share with a password.
   - Delete the account from Settings, then confirm that signing in again fails and the row is gone under Authentication → Users. On Supabase the `postgres` role normally can delete from `auth.users`. If it can't, the page shows an error and nothing is reported as deleted.
4. **Supabase → Authentication → Multi-Factor:** enable **TOTP**. Then enrol from Settings → Two-factor, sign out and back in, and confirm you get the code step.
5. **Supabase → Authentication:** turn on Confirm email, minimum password length 8 or more, leaked-password protection, CAPTCHA, and session time-box / inactivity timeout (§5).
6. **Netlify:**
   - Optionally set `SECURITY_ALERT_WEBHOOK_URL` (e.g. a Slack incoming webhook).
   - Add a log drain or alert on `"type":"security_event"`.
   - Password-protect deploy previews (C15).
7. **Untrack the local files** (no history rewrite needed; they aren't secrets):
   ```
   git rm -r --cached "Claude outputs" .idea
   git commit -m "chore: stop tracking local tooling output"
   ```
8. Disable `pg_graphql` if unused (B11), and confirm backups/PITR and SSL enforcement (C10).

### Trade-offs to know about

- **Every page now renders per request** (required for nonces). Static prerendering and CDN caching of HTML are off. Client-side performance is unchanged; server render time is added to the first byte.
- **Each authenticated API call makes one extra small database round trip** (`rate_limit_hit`).
- Share creation and account deletion **depend on migration 005**. Without it they return a generic error rather than misbehaving.

### Ongoing safeguards

- `tests/security/remediation-wiring.test.mjs` fails if any of these fixes is undone (raw error logging, unwrapped job posts, in-memory-only limits, `unsafe-inline` in `next.config.ts`, a direct hash RPC call, and so on).
- `tests/sql/` can be re-run against a local Postgres after any future migration.
- Review new SECURITY DEFINER functions for an explicit `REVOKE … FROM PUBLIC, anon, authenticated`: Supabase grants EXECUTE on new functions by default.
- Keep `npm audit --omit=dev` at 0, and bump the pinned Node patch version deliberately.
