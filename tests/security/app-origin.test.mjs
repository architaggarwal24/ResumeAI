import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAppOrigin } from '../../src/lib/security/app-origin.ts'

const REQ = 'https://evil.example' // what a spoofed Host header would produce

test('configured NEXT_PUBLIC_APP_URL wins over the request origin', () => {
  assert.equal(resolveAppOrigin(REQ, { NEXT_PUBLIC_APP_URL: 'https://resumeai.app' }), 'https://resumeai.app')
})

test('path, query and trailing slash in the config are dropped', () => {
  assert.equal(resolveAppOrigin(REQ, { NEXT_PUBLIC_APP_URL: 'https://resumeai.app/app/?x=1' }), 'https://resumeai.app')
})

test('platform variables are used when NEXT_PUBLIC_APP_URL is missing', () => {
  assert.equal(resolveAppOrigin(REQ, { URL: 'https://my-site.netlify.app' }), 'https://my-site.netlify.app')
  assert.equal(resolveAppOrigin(REQ, { VERCEL_PROJECT_PRODUCTION_URL: 'my-app.vercel.app' }), 'https://my-app.vercel.app')
})

test('invalid or non-http config is ignored', () => {
  assert.equal(resolveAppOrigin('http://localhost:3000', { NEXT_PUBLIC_APP_URL: 'javascript:alert(1)', NODE_ENV: 'development' }), 'http://localhost:3000')
  assert.equal(resolveAppOrigin('http://localhost:3000', { NEXT_PUBLIC_APP_URL: 'not a url', NODE_ENV: 'development' }), 'http://localhost:3000')
})

test('request origin is only a fallback outside production', () => {
  assert.equal(resolveAppOrigin('http://localhost:3000', { NODE_ENV: 'development' }), 'http://localhost:3000')
  assert.throws(() => resolveAppOrigin(REQ, { NODE_ENV: 'production' }), /NEXT_PUBLIC_APP_URL/)
})
