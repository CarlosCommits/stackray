import { eq, type SQL } from "drizzle-orm";

import { canRunScans, canViewScans, isAdmin } from "@/lib/authorization/authz";
import { scans } from "@/lib/db/schema";
import type { ActorContext } from "@/lib/session/actor-context";

export function assertCanRunScans(actor: ActorContext) {
  if (!canRunScans(actor)) {
    throw new Error("You do not have permission to create scans.");
  }
}

function assertCanViewScans(actor: ActorContext) {
  if (!canViewScans(actor)) {
    throw new Error("You do not have permission to view scans.");
  }
}

export function getVisibleScansFilter(actor: ActorContext): SQL<unknown> | undefined {
  assertCanViewScans(actor);

  if (isAdmin(actor)) {
    return undefined;
  }

  return eq(scans.createdByUserId, actor.user.id);
}
