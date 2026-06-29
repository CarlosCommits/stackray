import type { TaskList } from "graphile-worker";

export type StackrayWorkerRole = "all" | "http" | "intel" | "browser";

export const SMOKE_JOB_FLAG = "stackray-smoke";

const roleTaskNames = {
  all: ["http_probe", "run_scan", "headless", "browser_fallback", "subfinder", "nuclei_dns", "nuclei_http", "ip_intel", "finalize", "schedule_due_scans"],
  http: ["http_probe", "run_scan"],
  intel: ["subfinder", "nuclei_dns", "nuclei_http", "ip_intel", "finalize", "schedule_due_scans"],
  browser: ["headless", "browser_fallback"],
} as const satisfies Record<StackrayWorkerRole, readonly string[]>;

const defaultWorkerConcurrency = {
  all: 4,
  http: 15,
  intel: 8,
  browser: 3,
} as const satisfies Record<StackrayWorkerRole, number>;

export function resolveWorkerConcurrency(role: StackrayWorkerRole, configuredConcurrency?: number) {
  return configuredConcurrency ?? defaultWorkerConcurrency[role];
}

export function selectTaskListForRole<TTaskList extends TaskList>(taskList: TTaskList, role: StackrayWorkerRole): TaskList {
  const selected: TaskList = {};

  for (const taskName of roleTaskNames[role]) {
    const task = taskList[taskName];

    if (task) {
      selected[taskName] = task;
    }
  }

  return selected;
}

export function getTaskNamesForRole(role: StackrayWorkerRole) {
  return [...roleTaskNames[role]];
}

function parseFlagList(value?: string) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function resolveGraphileJobFlags(configuredFlags = process.env.STACKRAY_GRAPHILE_JOB_FLAGS) {
  const flags = parseFlagList(configuredFlags);
  return flags.length > 0 ? flags : undefined;
}

export function resolveForbiddenGraphileJobFlags({
  configuredFlags = process.env.STACKRAY_FORBIDDEN_GRAPHILE_JOB_FLAGS,
  allowSmokeJobs = process.env.STACKRAY_ALLOW_SMOKE_JOBS === "true",
}: {
  configuredFlags?: string;
  allowSmokeJobs?: boolean;
} = {}) {
  const flags = new Set(parseFlagList(configuredFlags));

  if (!allowSmokeJobs) {
    flags.add(SMOKE_JOB_FLAG);
  }

  return flags.size > 0 ? [...flags] : null;
}
