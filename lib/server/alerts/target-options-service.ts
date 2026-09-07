import { canManageAlerts } from "@/lib/authorization/authz";
import type { ActorContext } from "@/lib/session/actor-context";
import { getTargetResultsByCanonicalIds } from "@/lib/server/targets/service";

export async function listAlertPolicyTargetOptions(actor: ActorContext, canonicalTargetIds: readonly string[]) {
  if (!canManageAlerts(actor)) {
    throw new Error("You do not have permission to manage alerting.");
  }

  return getTargetResultsByCanonicalIds(actor, canonicalTargetIds);
}
