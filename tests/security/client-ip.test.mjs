import test from 'node:test'
import assert from 'node:assert/strict'
import { clientIpFromHeaders } from '../../src/lib/security/client-ip.ts'

const h = o => new Headers(o)

test('platform header beats a client-supplied X-Forwarded-For', () => {
  assert.equal(clientIpFromHeaders(h({ 'x-forwarded-for': '6.6.6.6', 'x-nf-client-connection-ip': '1.2.3.4' })), '1.2.3.4')
  assert.equal(clientIpFromHeaders(h({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4', 'x-real-ip': '1.2.3.4' })), '1.2.3.4')
})
test('falls back to the first X-Forwarded-For hop', () => {
  assert.equal(clientIpFromHeaders(h({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' })), '9.9.9.9')
})
test('IPv6 accepted; junk values ignored so forged headers can’t mint keys', () => {
  assert.equal(clientIpFromHeaders(h({ 'x-real-ip': '2001:db8::1' })), '2001:db8::1')
  assert.equal(clientIpFromHeaders(h({ 'x-nf-client-connection-ip': 'random-' + 'x'.repeat(100), 'x-real-ip': '5.5.5.5' })), '5.5.5.5')
  assert.equal(clientIpFromHeaders(h({ 'x-forwarded-for': '<script>' })), 'unknown')
  assert.equal(clientIpFromHeaders(h({})), 'unknown')
})
