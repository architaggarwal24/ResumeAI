// src/lib/security/security-log.ts
// Structured security events (C24). Each event is one JSON line on stderr with
// "type":"security_event", so the hosting platform's log search or a log drain
// can filter and alert on it. Optional: set SECURITY_ALERT_WEBHOOK_URL (server
// env, e.g. a Slack incoming webhook) to also POST alert-level events.
//
// Never pass secrets here. Field names that look sensitive are dropped and
// string values are truncated, as a backstop.

export type SecurityEvent =
  | 'rate_limited'
  | 'cross_origin_blocked'
  | 'share_unlock_failed'
  | 'share_create_throttled'
  | 'account_deleted'
  | 'account_delete_failed'
  | 'mfa_required'
  | 'server_error'

const ALERT_EVENTS: ReadonlySet<SecurityEvent> = new Set(['account_delete_failed', 'server_error'])
const SENSITIVE_KEY = /key|token|password|secret|authorization|cookie|email|jwt/i

export function sanitizeFields(fields: Record<string, unknown> = {}): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  for (const [k, v] of Object.entries(fields).slice(0, 20)) {
    if (SENSITIVE_KEY.test(k)) continue
    if (v === null || typeof v === 'number' || typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string') out[k] = v.slice(0, 200)
  }
  return out
}

export function formatSecurityEvent(event: SecurityEvent, fields?: Record<string, unknown>, now: Date = new Date()): string {
  return JSON.stringify({ type: 'security_event', event, ts: now.toISOString(), ...sanitizeFields(fields) })
}

export function logSecurityEvent(event: SecurityEvent, fields?: Record<string, unknown>): void {
  const line = formatSecurityEvent(event, fields)
  console.warn(line)
  const hook = typeof process !== 'undefined' ? process.env.SECURITY_ALERT_WEBHOOK_URL : undefined
  if (hook && hook.startsWith('https://') && ALERT_EVENTS.has(event)) {
    // Fire-and-forget; never block or fail the request on alerting.
    fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `ResumeAI security event: ${line}` }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {})
  }
}
