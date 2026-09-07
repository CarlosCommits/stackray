import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AlertsPageClient } from "@/components/settings/alerts/alerts-page-client";
import { canManageAlerts } from "@/lib/authorization/authz";
import { requireAppSession } from "@/lib/session/app-session";
import { isDevelopmentActorEnabled } from "@/lib/session/actor-context";
import { getAlertSettingsSnapshot } from "@/lib/server/alerts/service";
import { getTargetResults } from "@/lib/server/targets/service";
import { getPublicOrigin } from "@/lib/public-origin";
import { registerInstancePublicOrigin } from "@/lib/server/instance-runtime-settings";
import { DEMO_USER_EMAIL, isDemoModeEnabled } from "@/lib/demo-mode";
import {
  DEMO_MOCK_ALERT_CHANNELS,
  DEMO_MOCK_ALERT_POLICIES,
  DEMO_MOCK_ALERT_READINESS,
  DEMO_MOCK_EMAIL_PROVIDER,
} from "@/lib/demo-mode-data";

export const metadata: Metadata = {
  title: "Change alerts | Stackray",
  description: "Manage outbound change notification channels and alert policies.",
};

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isDemoModeEnabled()) {
    return (
      <AlertsPageClient
        demoMode
        devPreviewEnabled={false}
        initialReadiness={DEMO_MOCK_ALERT_READINESS}
        initialEmailProvider={DEMO_MOCK_EMAIL_PROVIDER}
        adminEmail={DEMO_USER_EMAIL}
        initialResendSetupId={null}
        initialResendError={null}
        initialResendDisconnected={false}
        initialChannels={DEMO_MOCK_ALERT_CHANNELS}
        initialPolicies={DEMO_MOCK_ALERT_POLICIES}
        initialTargetOptions={[]}
      />
    );
  }

  const session = await requireAppSession();
  if (!canManageAlerts(session)) redirect("/dashboard");
  const query = await searchParams;
  const publicOrigin = await getPublicOrigin();

  if (publicOrigin) {
    await registerInstancePublicOrigin(publicOrigin);
  }

  const [snapshot, targets] = await Promise.all([
    getAlertSettingsSnapshot(session),
    getTargetResults(session, { limit: "50" }),
  ]);

  return (
    <AlertsPageClient
      devPreviewEnabled={isDevelopmentActorEnabled()}
      initialReadiness={snapshot.readiness}
      initialEmailProvider={snapshot.emailProvider}
      adminEmail={session.user.email}
      initialResendSetupId={typeof query.resendSetup === "string" ? query.resendSetup : null}
      initialResendError={typeof query.resendError === "string" ? query.resendError : null}
      initialResendDisconnected={query.resendDisconnected === "1"}
      initialChannels={snapshot.channels}
      initialPolicies={snapshot.policies}
      initialTargetOptions={targets.items}
    />
  );
}
