import { env } from "@/lib/env/server";
import {
  DEFAULT_DEMO_SCAN_DAILY_LIMIT,
  DEMO_SCHEDULE_DISABLED_MESSAGE,
  DEMO_USER_EMAIL,
} from "@/lib/demo-mode-constants";
import type { ActorContext } from "@/lib/session/actor-context";

export {
  DEFAULT_DEMO_SCAN_DAILY_LIMIT,
  DEMO_SCHEDULE_DISABLED_MESSAGE,
  DEMO_USER_EMAIL,
};

export function isDemoModeEnabled() {
  return env.STACKRAY_ENABLE_DEMO === "true";
}

export function isDemoActor(actor: ActorContext) {
  return isDemoModeEnabled() && actor.user.email === DEMO_USER_EMAIL;
}

export function getDemoDailyScanLimit() {
  return env.STACKRAY_DEMO_DAILY_SCAN_LIMIT ?? DEFAULT_DEMO_SCAN_DAILY_LIMIT;
}
