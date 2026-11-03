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

test('005 takes the bcrypt helper away from clients and adds create_share', () => {
  const s = sql('005_security_remediation.sql')
  assert.match(s, /REVOKE ALL ON FUNCTION public\.hash_share_password\(text\) FROM PUBLIC, anon, authenticated/)
  assert.doesNotMatch(s, /GRANT EXECUTE ON FUNCTION public\.hash_share_password/)
  const fn = s.slice(s.indexOf('FUNCTION public.create_share'), s.indexOf('REVOKE ALL ON FUNCTION public.create_share'))
  // Throttle and cap checks both happen before any hashing.
  const iThrottle = fn.indexOf("rate_limit_hit('share_create')"), iCap = fn.indexOf('limit_reached:resume_shares'), iHash = fn.indexOf('hash_share_password(')
  assert.ok(iThrottle > 0 && iCap > iThrottle && iHash > iCap, 'throttle → cap → hash')
  assert.match(fn, /user_id = v_uid/, 'ownership check')
})

test('005 functions revoke the Supabase default grants explicitly', () => {
  const s = sql('005_security_remediation.sql')
  for (const f of ['session_meets_mfa\\(\\)', 'rate_limit_hit\\(text\\)', 'create_share\\(uuid, text, timestamptz\\)', 'delete_my_account\\(\\)']) {
    assert.match(s, new RegExp(`REVOKE ALL ON FUNCTION public\\.${f} FROM PUBLIC, anon, authenticated`), f)
    assert.match(s, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${f} TO authenticated;`), f)
  }
  assert.match(s, /SET search_path = public/)
  assert.doesNotMatch(s, /SECURITY DEFINER\s*\n\s*AS/, 'every SECURITY DEFINER pins search_path')
})

test('005 deletes the login itself and enforces MFA on every user table', () => {
  const s = sql('005_security_remediation.sql')
  assert.match(s, /DELETE FROM auth\.users WHERE id = v_uid/)
  for (const t of ['users', 'resumes', 'analyses', 'resume_versions', 'cover_letters', 'job_applications', 'resume_shares', 'notifications']) {
    assert.match(s, new RegExp(`'${t}'`), t)
  }
  assert.match(s, /AS RESTRICTIVE FOR ALL TO authenticated/)
})
