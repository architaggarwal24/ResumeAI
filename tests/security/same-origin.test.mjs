import test from 'node:test'
import assert from 'node:assert/strict'
import { isCrossOriginApiWrite } from '../../src/lib/security/same-origin.ts'

const base = { method: 'POST', pathname: '/api/resume', secFetchSite: null, origin: null, allowedOrigins: ['https://app.example.com'] }
const blocked = o => isCrossOriginApiWrite({ ...base, ...o })

test('same-origin browser writes pass', () => {
  assert.equal(blocked({ secFetchSite: 'same-origin', origin: 'https://app.example.com' }), false)
})
test('cross-site and same-site (sibling subdomain) writes are blocked', () => {
  assert.equal(blocked({ secFetchSite: 'cross-site', origin: 'https://evil.example' }), true)
  assert.equal(blocked({ secFetchSite: 'same-site', origin: 'https://blog.example.com' }), true)
})
test('Sec-Fetch-Site wins over a matching Origin', () => {
  assert.equal(blocked({ secFetchSite: 'same-site', origin: 'https://app.example.com' }), true)
})
test('without Sec-Fetch-Site, Origin must be ours', () => {
  assert.equal(blocked({ origin: 'https://evil.example' }), true)
  assert.equal(blocked({ origin: 'null' }), true)
  assert.equal(blocked({ origin: 'https://app.example.com' }), false)
})
test('non-browser clients (no headers) reach normal auth checks', () => {
  assert.equal(blocked({}), false)
})
test('reads and non-API paths are never blocked', () => {
  assert.equal(blocked({ method: 'GET', secFetchSite: 'cross-site' }), false)
  assert.equal(blocked({ method: 'options', secFetchSite: 'cross-site' }), false)
  assert.equal(blocked({ pathname: '/login', secFetchSite: 'cross-site' }), false)
})
test('all write methods are covered', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(blocked({ method, secFetchSite: 'cross-site' }), true, method)
})
