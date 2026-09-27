// src/lib/llm/ollama-guard.ts
// Ollama is the only provider whose target URL is user-supplied (BYOK
// "baseUrl" for local models) rather than one of the fixed provider URLs.
// Restrict it to the local Ollama daemon to prevent it being used as an
// open SSRF proxy against internal/cloud-metadata hosts. Shared by every
// route that accepts an Ollama baseUrl: /api/llm, /api/test-connection,
// and /api/chat.
export function isAllowedOllamaUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:') return false
  if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return false
  if (u.port !== '11434') return false
  return true
}
