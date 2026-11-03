// src/instrumentation.ts
// Server error reporting (C24). Every uncaught server error becomes one
// structured "security_event" log line (no message text, no headers, no query
// string — those can hold tokens or personal data). With
// SECURITY_ALERT_WEBHOOK_URL set, it is also posted to that webhook.
import type { Instrumentation } from 'next'
import { logSecurityEvent } from '@/lib/security/security-log'

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const digest = typeof err === 'object' && err !== null && 'digest' in err ? String((err as { digest: unknown }).digest) : undefined
  logSecurityEvent('server_error', {
    name: err instanceof Error ? err.name : 'unknown',
    digest,
    method: request.method,
    path: request.path.split('?')[0],
    routePath: context.routePath,
    routeType: context.routeType,
  })
}
