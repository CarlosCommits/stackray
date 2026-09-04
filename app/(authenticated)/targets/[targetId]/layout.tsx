import { notFound } from "next/navigation"

import { PageTitle } from "@/components/shell/page-title"
import { TargetProfileShell } from "@/components/targets/profile/target-profile-shell"
import { formatTargetForDisplay } from "@/lib/targets/display-target"
import { requireAppSession } from "@/lib/session/app-session"
import { getTargetProfileIdentity } from "@/lib/server/targets/profile-service"

export default async function TargetProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ targetId: string }>
}) {
  const [session, { targetId }] = await Promise.all([requireAppSession(), params])
  const identity = await getTargetProfileIdentity(session, targetId)

  if (!identity) {
    notFound()
  }

  return (
    <>
      <PageTitle value={formatTargetForDisplay(identity.target)} />
      <TargetProfileShell identity={identity}>{children}</TargetProfileShell>
    </>
  )
}
