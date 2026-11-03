// src/app/(app)/layout.tsx
import { requireUser } from '@/lib/supabase/require-user'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser()

  return <AppShell user={user}>{children}</AppShell>
}
