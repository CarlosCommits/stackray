import { redirect } from "next/navigation"

import { CustomDomainPageClient } from "@/components/setup/custom-domain-page-client"
import { isAdmin } from "@/lib/authorization/authz"
import { requireAppSession } from "@/lib/session/app-session"
import { getCustomDomainState } from "@/lib/server/setup/service"

export default async function CustomDomainPage() {
  const session = await requireAppSession()

  if (!isAdmin(session)) {
    redirect("/dashboard")
  }

  const customDomainState = await getCustomDomainState(session)

  return <CustomDomainPageClient initialState={customDomainState} />
}