// Source-level checks that the SECURITY_AUDIT.md fixes stay wired in.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../', import.meta.url).pathname
const read = p => readFileSync(join(root, p), 'utf8')
function walk(dir, out = []) {
  for (const f of readdirSync(join(root, dir))) {
    const p = join(dir, f)
    if (statSync(join(root, p)).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(f)) out.push(p)
  }
  return out
}
const apiFiles = walk('src/app/api')

test('Q1: no client code calls hash_share_password; shares go through create_share', () => {
  for (const f of walk('src')) assert.doesNotMatch(read(f), /rpc\(\s*'hash_share_password'/, f)
  assert.match(read('src/app/api/share/route.ts'), /rpc\('create_share'/)
})

test('Q3: settings deletes through the API and checks the result', () => {
  const s = read('src/app/(app)/settings/page.tsx')
  assert.doesNotMatch(s, /from\('users'\)\.delete\(\)/)
  assert.match(s, /\/api\/account\/delete/)
  assert.match(s, /data\.deleted !== true/)
  assert.match(read('src/app/api/account/delete/route.ts'), /rpc\('delete_my_account'\)/)
})

test('Q4/L1: proxy blocks cross-origin API writes and sets a nonce CSP', () => {
  const p = read('src/proxy.ts')
  assert.match(p, /isCrossOriginApiWrite\(/)
  assert.match(p, /buildPageCsp\(/)
  assert.doesNotMatch(read('next.config.ts'), /unsafe-inline/)
  assert.match(read('src/app/layout.tsx'), /await connection\(\)/)
})

test('L3: per-user limits use the shared limiter in every route', () => {
  for (const f of apiFiles) {
    assert.doesNotMatch(read(f), /limit\(limiters\.(ai|llmProxy|testConn|export|write),/, f)
  }
})

test('Q5: streaming has a server-side deadline', () => {
  assert.match(read('src/lib/llm/server.ts'), /withTimeout\(input\.signal, streamTimeout\)/); assert.match(read('src/lib/llm/server.ts'), /: STREAM_TIMEOUT_MS/)
})

test('Q6: API routes never log a raw error object', () => {
  for (const f of apiFiles) {
    assert.doesNotMatch(read(f), /console\.(error|warn|log)\([^)]*,\s*(err|error|e|enrichErr)\s*\)/, f)
  }
})

test('Q8: third-party job posts and pages are wrapped before prompting', () => {
  for (const f of ['src/app/api/analyze/route.ts', 'src/app/api/cover-letter/route.ts', 'src/app/api/resume/tailor/route.ts', 'src/app/api/interview/route.ts', 'src/app/api/linkedin/route.ts']) {
    const s = read(f)
    assert.match(s, /untrusted\('/, f)
    assert.doesNotMatch(s, /Job Description:\\n\$\{(body\.|raw\.)?jobDescription/, f)
  }
})

test('L2: MFA gate in API auth, page auth and middleware', () => {
  assert.match(read('src/lib/security/guards.ts'), /sessionNeedsSecondFactor\(supabase, user\)/)
  assert.match(read('src/lib/supabase/require-user.ts'), /redirect\('\/mfa'\)/)
  assert.match(read('src/lib/supabase/middleware.ts'), /needsSecondFactor\(/)
})

test('Q9: Node pinned exactly; local tooling ignored', () => {
  assert.match(read('netlify.toml'), /NODE_VERSION = "\d+\.\d+\.\d+"/)
  const gi = read('.gitignore')
  for (const line of ['.idea/', 'Claude outputs/', '.env*', '!.env.example']) assert.ok(gi.split('\n').includes(line), line)
})

// ─── Bugs found in the full-app sandbox run (2026-11-03) ─────────────────────
test('job card menu ignores its own clicks in the document listener', () => {
  const s = read('src/app/(app)/jobs/JobBoard.tsx')
  assert.match(s, /closest\('\[data-job-menu\]'\)/)
  assert.match(s, /data-job-menu>/)
})
test('auto-score runs from an effect, not during render', () => {
  const s = read('src/components/resume/ScoreTab.tsx')
  assert.doesNotMatch(s, /^\s*if \(!safeResult && !isLoading && resumeData && byokCreds\.apiKey\) \{\s*\n\s*setTimeout\(runScoring/m)
  assert.match(s, /autoScoredFor\.current = resumeId/)
})
test('opening a resume clears the previous resume’s results', () => {
  const s = read('src/components/resume/ResumeShell.tsx')
  assert.match(s, /setAnalysisResult\(initialAnalysis \?\? null\)/)
  assert.match(s, /setATSResult\(null\)/)
})
test('Save All commits fields that are still open', () => {
  assert.match(read('src/components/resume/EditorTab.tsx'), /for \(const commit of \[\.\.\.pendingEdits\.values\(\)\]\) commit\(\)/)
})
test('native select popups get an opaque dark list', () => {
  assert.match(read('src/app/globals.css'), /select option, select optgroup \{ background-color: var\(--bg2\)/)
})
test('upload sends more of the resume and a bigger token budget', () => {
  const s = read('src/app/(app)/upload/page.tsx')
  assert.match(s, /rawText\.slice\(0, 15_000\)/)
  assert.match(s, /maxTokens: 8192/)
})
test('coach edit blocks use the tolerant parser and collapse the gap', () => {
  const s = read('src/lib/resumeEdits.ts')
  assert.match(s, /extractJsonObject\(jsonStr\)/)
  assert.match(s, /\.replace\(\/\\n\{3,\}\/g, '\\n\\n'\)/)
})
test('retired models (404/410) get a clear message and upload falls back to the chosen model', () => {
  const srv = read('src/lib/llm/server.ts')
  assert.match(srv, /function modelUnavailable\(/)
  assert.equal((srv.match(/res\.status === 404 \|\| res\.status === 410/g) || []).length >= 6, true)
  assert.match(read('src/lib/llm/client.ts'), /if \(res\.status === 404 \|\| res\.status === 410\) throw new LLMError\(msg, 'model'/)
  const up = read('src/app/(app)/upload/page.tsx')
  assert.match(up, /err\.code === 'model' && parseCreds\.model !== byokCreds\.model/)
  assert.match(up, /initial=\{\{ strokeDashoffset: 276 \}\}/)
})
test('every failed model call is logged; retired NVIDIA model is gone', () => {
  const srv = read('src/lib/llm/server.ts')
  assert.match(srv, /function logLlmFailure\(/)
  assert.ok((srv.match(/logLlmFailure\(/g) || []).length >= 4)
  assert.doesNotMatch(read('src/lib/llm/client.ts'), /'nvidia\/nemotron-3-nano-30b-a3b',/)
  assert.match(read('src/app/api/test-connection/route.ts'), /console\.error\(`\[llm\] test-connection failed/)
})
test('job tracker route shows Coming soon; the board is kept for later', () => {
  assert.match(read('src/app/(app)/jobs/page.tsx'), /Coming soon/)
  assert.match(read('src/app/(app)/jobs/JobBoard.tsx'), /export default function JobBoard\(/)
  assert.match(read('src/components/layout/AppShell.tsx'), /label: 'Job tracker', soon: true/)
})
