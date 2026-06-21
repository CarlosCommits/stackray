import type { TaskList } from "graphile-worker";

export type StackrayWorkerRole = "all" | "http" | "intel" | "browser";

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
