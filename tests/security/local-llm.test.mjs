import test from 'node:test'
import assert from 'node:assert/strict'
import { localLlmEnabled, localBaseUrl, llmTimeoutMs, DEFAULT_LOCAL_BASE_URL } from '../../src/lib/llm/local.ts'
import { validateCreds } from '../../src/lib/llm/validate.ts'

test('local models are off unless explicitly enabled', () => {
  assert.equal(localLlmEnabled({}), false)
  assert.equal(localLlmEnabled({ NEXT_PUBLIC_ENABLE_LOCAL_LLM: '1' }), false)
  assert.equal(localLlmEnabled({ NEXT_PUBLIC_ENABLE_LOCAL_LLM: 'true' }), true)
})
test('base URL comes from env, defaults to Ollama, rejects non-http', () => {
  assert.equal(localBaseUrl({}), DEFAULT_LOCAL_BASE_URL)
  assert.equal(localBaseUrl({ LOCAL_LLM_BASE_URL: 'http://127.0.0.1:1234/v1/' }), 'http://127.0.0.1:1234/v1')
  assert.equal(localBaseUrl({ LOCAL_LLM_BASE_URL: 'file:///etc/passwd' }), null)
  assert.equal(localBaseUrl({ LOCAL_LLM_BASE_URL: 'http://user:pw@host/v1' }), null)
})
test('timeouts: local gets longer by default, env override bounded', () => {
  assert.equal(llmTimeoutMs('nvidia', {}), 60_000)
  assert.equal(llmTimeoutMs('local', {}), 180_000)
  assert.equal(llmTimeoutMs('nvidia', { LLM_TIMEOUT_MS: '120000' }), 120_000)
  assert.equal(llmTimeoutMs('nvidia', { LLM_TIMEOUT_MS: '10' }), 60_000)
  assert.equal(llmTimeoutMs('nvidia', { LLM_TIMEOUT_MS: '99999999' }), 600_000)
})
test('local creds validate with Ollama-style model ids; the browser cannot pass a URL', () => {
  const r = validateCreds({ provider: 'local', apiKey: 'local-no-key', model: 'llama3.1:8b', baseUrl: 'http://169.254.169.254/' })
  assert.equal(r.ok, true); assert.deepEqual(Object.keys(r.creds).sort(), ['apiKey', 'model', 'provider'])
})
