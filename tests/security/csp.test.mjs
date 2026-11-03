import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPageCsp, generateNonce, API_CSP } from '../../src/lib/security/csp.ts'

const directive = (csp, name) => csp.split('; ').find(d => d.startsWith(name + ' '))

test('production page CSP: nonce + strict-dynamic, no unsafe-inline/eval for scripts', () => {
  const csp = buildPageCsp({ nonce: 'abc123', isProd: true, supabaseUrl: 'https://xyz.supabase.co' })
  const script = directive(csp, 'script-src')
  assert.match(script, /'nonce-abc123'/)
  assert.match(script, /'strict-dynamic'/)
  assert.doesNotMatch(script, /unsafe-inline|unsafe-eval/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /upgrade-insecure-requests/)
  assert.match(directive(csp, 'connect-src'), /https:\/\/xyz\.supabase\.co wss:\/\/xyz\.supabase\.co/)
})
test('dev CSP allows eval (React dev tooling) but stays nonce-based', () => {
  const script = directive(buildPageCsp({ nonce: 'n', isProd: false }), 'script-src')
  assert.match(script, /'unsafe-eval'/); assert.doesNotMatch(script, /unsafe-inline/)
})
test('bad Supabase URL does not inject sources', () => {
  assert.equal(directive(buildPageCsp({ nonce: 'n', isProd: true, supabaseUrl: "javascript:alert(1)" }), 'connect-src'), "connect-src 'self'")
})
test('nonces are random, 128-bit base64', () => {
  const a = generateNonce(), b = generateNonce()
  assert.notEqual(a, b); assert.equal(Buffer.from(a, 'base64').length, 16)
})
test('API responses get a deny-all CSP', () => {
  assert.match(API_CSP, /default-src 'none'/)
})
