import { requireAppSession } from "@/lib/auth/session";
import { getDashboardSnapshot as getDashboardSnapshotData } from "@/lib/server/dashboard/service";

export async function getDashboardSnapshot() {
  const session = await requireAppSession();

  return getDashboardSnapshotData(session);
}
