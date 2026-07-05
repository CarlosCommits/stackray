import type { SQL } from "drizzle-orm";

import { canRunScans, canViewScans } from "@/lib/authorization/authz";
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
  return undefined;
}
