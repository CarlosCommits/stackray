import { describe, expect, it } from "vitest";

import { scanPhaseKindEnum } from "../drizzle/schema.ts";
import { taskList } from "./tasks.ts";

const expectedGraphileTaskNames = [
  "browser_fallback",
  "finalize",
  "headless",
  "http_probe",
  "ip_intel",
  "nuclei_dns",
  "nuclei_http",
  "run_scan",
  "schedule_due_scans",
  "subfinder",
];

describe("worker task alignment", () => {
  it("keeps Graphile task names stable", () => {
    expect(Object.keys(taskList).toSorted()).toEqual(expectedGraphileTaskNames);
  });

  it("has a Graphile task for every persisted scan phase", () => {
    expect(scanPhaseKindEnum.enumValues.toSorted()).toEqual([
      "browser_fallback",
      "finalize",
      "headless",
      "http_probe",
      "ip_intel",
      "nuclei_dns",
      "nuclei_http",
      "subfinder",
    ]);

    for (const phase of scanPhaseKindEnum.enumValues) {
      expect(taskList).toHaveProperty(phase);
    }
  });
});
