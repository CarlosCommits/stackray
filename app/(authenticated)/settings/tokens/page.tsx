import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/session/app-session";
import { canAccessApiTokens } from "@/lib/authorization/authz";
import { TokensPageClient } from "@/components/settings/tokens/tokens-page-client";
import { listApiTokens } from "@/lib/server/tokens/service";

export default async function TokensPage() {
  const session = await requireAppSession();

  if (!canAccessApiTokens(session)) {
    return (
      <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
        <CardHeader>
          <CardTitle className="text-[var(--foreground)]">API tokens disabled</CardTitle>
          <CardDescription className="text-[var(--text-dim)]">
            An admin has disabled API token access for this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-[var(--text-dim)]">
          You can still use the web app normally, but bearer-token access is unavailable until an admin re-enables it.
        </CardContent>
      </Card>
    );
  }

  const response = await listApiTokens(session);

  return <TokensPageClient initialTokens={response.items} />;
}
