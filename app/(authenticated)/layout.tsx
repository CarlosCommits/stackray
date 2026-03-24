import { redirect } from "next/navigation"

import { AppShell } from "@/components/shell"
import { getAppSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAppSession()

  if (!session) {
    redirect("/")
  }

  return (
    <AppShell workspace={session.workspace.name}>
      {children}
    </AppShell>
  )
}
