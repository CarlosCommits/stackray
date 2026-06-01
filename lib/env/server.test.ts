import { describe, expect, it } from "vitest";

import { inferWorkerRoleFromServiceName } from "./server";

describe("inferWorkerRoleFromServiceName", () => {
  it("maps Railway worker service names to Stackray worker roles", () => {
    expect(inferWorkerRoleFromServiceName("worker-http")).toBe("http");
    expect(inferWorkerRoleFromServiceName("worker-intel")).toBe("intel");
    expect(inferWorkerRoleFromServiceName("worker-headless")).toBe("headless");
  });

  it("does not infer a role for unknown services", () => {
    expect(inferWorkerRoleFromServiceName("Stackray-nextjs")).toBeUndefined();
    expect(inferWorkerRoleFromServiceName(undefined)).toBeUndefined();
  });
});
