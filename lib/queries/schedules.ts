import { requireAppSession } from "@/lib/session/app-session";
import { listSchedules } from "@/lib/server/schedules/service";

export async function getSchedulesPageData() {
  const session = await requireAppSession();
  return listSchedules(session);
}
