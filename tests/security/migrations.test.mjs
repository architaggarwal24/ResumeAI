import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = f => readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8')
// Strip SQL line comments so explanatory notes don't count as policy text.
const sql = f => read(f).replace(/--.*$/gm, '')

test('reset script never recreates a world-readable share policy', () => {
  const s = sql('000_reset.sql')
  assert.doesNotMatch(s, /shares_public_read/)
  assert.doesNotMatch(s, /CREATE POLICY[^;]*USING\s*\(\s*true\s*\)/i)
})

test('reset script checks resume ownership on share and job inserts', () => {
  const s = sql('000_reset.sql')
  for (const name of ['shares_owner', 'job_apps_own']) {
    const m = s.match(new RegExp(`CREATE POLICY "${name}"[^;]*;`, 'i'))
    assert.ok(m, `${name} policy present`)
    assert.match(m[0], /WITH CHECK/i, `${name} has WITH CHECK`)
    assert.match(m[0], /r\.user_id = auth\.uid\(\)/, `${name} checks the resume owner`)
  }
})

test('004 enforces every per-owner cap with a BEFORE INSERT trigger', () => {
  const s = sql('004_atomic_caps.sql')
  for (const [table, col, cap] of [['resumes', 'user_id', 200], ['job_applications', 'user_id', 1000], ['resume_versions', 'resume_id', 100], ['resume_shares', 'resume_id', 25]]) {
    assert.match(s, new RegExp(`BEFORE INSERT ON public\\.${table}\\s+FOR EACH ROW EXECUTE FUNCTION public\\.enforce_row_cap\\('${col}', '${cap}'\\)`), table)
  }
  assert.match(s, /pg_advisory_xact_lock/)
})
