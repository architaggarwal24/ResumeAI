import test from 'node:test'
import assert from 'node:assert/strict'
import { safeHttpUrl, safeInternalHref } from '../../src/lib/security/url.ts'

test('safeHttpUrl accepts http(s)', () => {
  assert.equal(safeHttpUrl('https://example.com/job/1'), 'https://example.com/job/1')
  assert.equal(safeHttpUrl('  http://example.com  '), 'http://example.com/')
})
test('safeHttpUrl adds https to bare hosts', () => {
  assert.equal(safeHttpUrl('example.com/careers'), 'https://example.com/careers')
})
for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>',
  'ftp://example.com', 'vbscript:x', 'https://user:pw@example.com', '', '   ', 'not a url', null, undefined, 42, {}]) {
  test(`safeHttpUrl rejects ${JSON.stringify(bad)}`, () => assert.equal(safeHttpUrl(bad), null))
}
test('safeHttpUrl rejects oversize', () => {
  assert.equal(safeHttpUrl('https://example.com/' + 'a'.repeat(3000)), null)
})
test('safeInternalHref allows only in-app paths', () => {
  assert.equal(safeInternalHref('/resume/1'), '/resume/1')
  assert.equal(safeInternalHref('/jobs'), '/jobs')
  for (const bad of ['//evil.example', 'https://evil.example', 'javascript:1', '@x', '', null, 5]) {
    assert.equal(safeInternalHref(bad), null)
  }
})
