import { canAccessApiTokens } from "@/lib/authorization/authz"
import { requireAppSession } from "@/lib/session/app-session"
import { buildApiDocsContent } from "@/lib/api-docs/content"
import { getEffectivePublicUrl } from "@/lib/server/setup/service"
import { ApiDocsNav, type TocItem } from "@/components/settings/api-docs/api-docs-nav"
import { ApiDocsClient } from "@/components/settings/api-docs/api-docs-client"

export default async function ApiDocsPage() {
  const session = await requireAppSession()
  const tokensEnabled = canAccessApiTokens(session)
  const content = buildApiDocsContent(tokensEnabled, (await getEffectivePublicUrl()) ?? undefined)

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex gap-8">
        <ApiDocsNav items={content.tocItems as TocItem[]} />
        <ApiDocsClient content={content} />
      </div>
    </div>
  )
}
