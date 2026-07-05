import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/session/app-session";
import { canAccessApiKeys } from "@/lib/authorization/authz";
import { ApiKeysPageClient } from "@/components/settings/api-keys/api-keys-page-client";
import { listApiKeys } from "@/lib/server/api-keys/service";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { DEMO_MOCK_API_KEYS } from "@/lib/demo-mode-data";

export const metadata: Metadata = {
  title: "API keys | Stackray",
  description: "Create, revoke, and manage Stackray API keys.",
};

export default async function ApiKeysPage() {
  if (isDemoModeEnabled()) {
    return <ApiKeysPageClient initialApiKeys={DEMO_MOCK_API_KEYS} demoMode />;
  }

  const session = await requireAppSession();

  if (!canAccessApiKeys(session)) {
    return (
      <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
        <CardHeader>
          <CardTitle className="text-[var(--foreground)]">API keys disabled</CardTitle>
          <CardDescription className="text-[var(--text-dim)]">
            An admin has disabled API key access for this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-[var(--text-dim)]">
          You can still use the web app normally, but API key access is unavailable until an admin re-enables it.
        </CardContent>
      </Card>
    );
  }

  const response = await listApiKeys(session);

  return <ApiKeysPageClient initialApiKeys={response.items} />;
}
