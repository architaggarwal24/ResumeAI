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
  assert.match(read('src/lib/llm/server.ts'), /withTimeout\(input\.signal, STREAM_TIMEOUT_MS\)/)
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
