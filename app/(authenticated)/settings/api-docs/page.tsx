import type { Metadata } from "next"

import { canAccessApiTokens } from "@/lib/authorization/authz"
import { requireAppSession } from "@/lib/session/app-session"
import { buildApiDocsContent } from "@/lib/api-docs/content"
import { getPublicOrigin } from "@/lib/public-origin"
import { ApiDocsNav, type TocItem } from "@/components/settings/api-docs/api-docs-nav"
import { ApiDocsClient } from "@/components/settings/api-docs/api-docs-client"

export const metadata: Metadata = {
  title: "API docs | Stackray",
  description: "Read Stackray API authentication and scan automation documentation.",
}

export default async function ApiDocsPage() {
  const session = await requireAppSession()
  const tokensEnabled = canAccessApiTokens(session)
  const publicOrigin = await getPublicOrigin()
  const content = buildApiDocsContent(tokensEnabled, publicOrigin ?? undefined)

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex gap-8">
        <ApiDocsNav items={content.tocItems as TocItem[]} />
        <ApiDocsClient content={content} />
      </div>
    </div>
  )
}
