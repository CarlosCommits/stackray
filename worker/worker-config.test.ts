import { describe, expect, it } from "vitest";

import { taskList } from "./tasks.ts";
import {
  getTaskNamesForRole,
  resolveForbiddenGraphileJobFlags,
  resolveGraphileJobFlags,
  resolveWorkerConcurrency,
  selectTaskListForRole,
  SMOKE_JOB_FLAG,
  type StackrayWorkerRole,
} from "./worker-config.ts";

const railwayWorkerRoles = {
  "worker-http": "http",
  "worker-intel": "intel",
  "worker-browser": "browser",
} as const satisfies Record<string, StackrayWorkerRole>;

describe("worker role config", () => {
  it("keeps Railway worker roles aligned with task names", () => {
    expect(railwayWorkerRoles).toEqual({
      "worker-http": "http",
      "worker-intel": "intel",
      "worker-browser": "browser",
    });
    expect(getTaskNamesForRole("http")).toEqual(["http_probe", "run_scan"]);
    expect(getTaskNamesForRole("intel")).toEqual(["subfinder", "nuclei_dns", "nuclei_http", "ip_intel", "finalize", "schedule_due_scans"]);
    expect(getTaskNamesForRole("browser")).toEqual(["headless", "browser_fallback"]);
  });

  it("selects only tasks that exist in the Graphile task list", () => {
    for (const role of ["all", "http", "intel", "browser"] as const) {
      expect(Object.keys(selectTaskListForRole(taskList, role))).toEqual(getTaskNamesForRole(role));
    }
  });

  it("keeps role concurrency defaults stable", () => {
    expect(resolveWorkerConcurrency("all")).toBe(4);
    expect(resolveWorkerConcurrency("http")).toBe(15);
    expect(resolveWorkerConcurrency("intel")).toBe(8);
    expect(resolveWorkerConcurrency("browser")).toBe(3);
    expect(resolveWorkerConcurrency("http", 2)).toBe(2);
  });

  it("skips smoke jobs in normal workers and lets smoke workers opt in", () => {
    expect(resolveForbiddenGraphileJobFlags()).toEqual([SMOKE_JOB_FLAG]);
    expect(resolveForbiddenGraphileJobFlags({ allowSmokeJobs: true })).toBeNull();
    expect(resolveForbiddenGraphileJobFlags({ configuredFlags: "alpha, beta", allowSmokeJobs: false })).toEqual(["alpha", "beta", SMOKE_JOB_FLAG]);
    expect(resolveGraphileJobFlags("alpha, beta")).toEqual(["alpha", "beta"]);
    expect(resolveGraphileJobFlags("")).toBeUndefined();
  });
});
