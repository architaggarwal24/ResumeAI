import test from 'node:test'
import assert from 'node:assert/strict'
import { safeNextPath } from '../../src/lib/security/redirect.ts'

test('allows normal in-app paths', () => {
  assert.equal(safeNextPath('/dashboard'), '/dashboard')
  assert.equal(safeNextPath('/resume/abc?tab=score#top'), '/resume/abc?tab=score#top')
})
test('falls back for missing input', () => {
  assert.equal(safeNextPath(null), '/dashboard')
  assert.equal(safeNextPath(undefined), '/dashboard')
  assert.equal(safeNextPath(''), '/dashboard')
  assert.equal(safeNextPath('', '/x'), '/x')
})
for (const bad of ['@evil.example', '.evil.example', '//evil.example', '/\\evil.example',
  'https://evil.example', 'javascript:alert(1)', '/\t/evil.example', '/\n/evil.example',
  'dashboard', '/..\\evil', '/a\\b']) {
  test(`rejects ${JSON.stringify(bad)}`, () => {
    assert.equal(safeNextPath(bad), '/dashboard')
  })
}
test('resulting URL always stays on our origin', () => {
  for (const raw of ['@evil.example', '.evil.example', '//evil.example', '/ok']) {
    const dest = new URL(`https://app.example.com${safeNextPath(raw)}`)
    assert.equal(dest.host, 'app.example.com')
  }
})
