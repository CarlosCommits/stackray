import { requireAppSession } from "@/lib/auth/session";
import { getWorkspaceDashboardSnapshot } from "@/lib/server/dashboard/service";

export async function getDashboardSnapshot() {
  const session = await requireAppSession();

  return getWorkspaceDashboardSnapshot(session);
}
