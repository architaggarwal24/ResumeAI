// src/app/api/account/delete/route.ts
// POST /api/account/delete — permanently deletes the caller's account.
// The database function delete_my_account() (migration 005) removes the login
// from auth.users; every app table cascades from it. The response says
// `deleted: true` only when the database confirms a row was removed, so the
// settings page can no longer report success after a failed delete.
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, parseBody, MAX_BODY } from '@/lib/security/guards'
import { mapDeleteAccountError } from '@/lib/security/db-errors'
import { logSecurityEvent } from '@/lib/security/security-log'

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthedUser()
    if (!user) return unauthorized()

    // Explicit confirmation in the body, so a stray or forged request can't
    // delete an account.
    const parsed = await parseBody<{ confirm?: unknown }>(request, MAX_BODY.small)
    if (!parsed.ok) return parsed.response
    if (parsed.data?.confirm !== 'DELETE') {
      return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('delete_my_account')
    if (error || data !== true) {
      const mapped = mapDeleteAccountError(error)
      logSecurityEvent('account_delete_failed', { userId: user.id, code: error?.code ?? 'no_row' })
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }

    logSecurityEvent('account_deleted', { userId: user.id })
    // The session's user no longer exists; clear the auth cookies locally.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[POST /api/account/delete]', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ error: 'Account deletion failed — please try again.' }, { status: 500 })
  }
}
