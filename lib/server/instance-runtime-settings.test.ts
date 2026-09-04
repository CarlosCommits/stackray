import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return { from, limit, select, where };
});

vi.mock("../db/client.ts", () => ({
  db: {
    select: dbMocks.select,
  },
}));

import {
  getRequiredInstancePublicOrigin,
  InstancePublicOriginUnavailableError,
} from "./instance-runtime-settings.ts";

describe("instance runtime settings", () => {
  beforeEach(() => {
    for (const mock of Object.values(dbMocks)) {
      mock.mockClear();
    }
  });

  it("treats a missing runtime-settings table as temporary upgrade readiness", async () => {
    dbMocks.limit.mockRejectedValueOnce(Object.assign(new Error("relation does not exist"), {
      code: "42P01",
    }));

    await expect(getRequiredInstancePublicOrigin()).rejects.toBeInstanceOf(
      InstancePublicOriginUnavailableError,
    );
  });

  it("treats a missing settings row as temporary upgrade readiness", async () => {
    dbMocks.limit.mockResolvedValueOnce([]);

    await expect(getRequiredInstancePublicOrigin()).rejects.toBeInstanceOf(
      InstancePublicOriginUnavailableError,
    );
  });

  it("returns a normalized stored origin", async () => {
    dbMocks.limit.mockResolvedValueOnce([{
      publicOrigin: "https://stackray.example/settings/alerts",
    }]);

    await expect(getRequiredInstancePublicOrigin()).resolves.toBe("https://stackray.example");
  });

  it("does not hide unrelated database failures", async () => {
    const error = Object.assign(new Error("connection terminated"), { code: "57P01" });
    dbMocks.limit.mockRejectedValueOnce(error);

    await expect(getRequiredInstancePublicOrigin()).rejects.toBe(error);
  });
});
