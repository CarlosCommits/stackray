import { z } from "zod";

import { runScanById } from "./scan-worker.ts";
import { dispatchDueSchedules } from "./schedules.ts";

const runScanPayloadSchema = z.object({
  scanId: z.string().min(1),
});

export const taskList = {
  run_scan: async (payload: unknown) => {
    const parsed = runScanPayloadSchema.parse(payload);
    await runScanById(parsed.scanId);
  },
  schedule_due_scans: async (payload: unknown) => {
    if (payload !== undefined && typeof payload !== "object") {
      throw new Error("schedule_due_scans expects an object payload.");
    }

    await dispatchDueSchedules();
  },
};
