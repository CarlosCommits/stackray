import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getVisibleScansFilter: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock("@/lib/server/scans/access", () => ({
  getVisibleScansFilter: mocks.getVisibleScansFilter,
}));

function mockScanSelectRows(rows: unknown[] = []) {
  mocks.limit.mockResolvedValue(rows);
  mocks.orderBy.mockReturnValue({ limit: mocks.limit });
  mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
  mocks.from.mockReturnValue({ where: mocks.where });
  mocks.select.mockReturnValue({ from: mocks.from });
}

describe("listScans", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.getVisibleScansFilter.mockReset();
    mocks.limit.mockReset();
    mocks.orderBy.mockReset();
    mocks.select.mockReset();
    mocks.where.mockReset();
    mocks.getVisibleScansFilter.mockReturnValue(undefined);
    mockScanSelectRows();
  });

  it("pushes scan filters and limits into the database query", async () => {
    const { listScans } = await import("@/lib/server/scans/read-service");

    await listScans({
      user: { id: "user_01", role: "admin" },
      source: "ui",
      apiKey: null,
    } as never, {
      status: "completed",
      source: "ui",
      target: "status-target.example.test",
      limit: 4,
    });

    expect(mocks.where).toHaveBeenCalledWith(expect.anything());
    expect(mocks.limit).toHaveBeenCalledWith(4);
  });

  it("clamps oversized scan list limits", async () => {
    const { listScans } = await import("@/lib/server/scans/read-service");

    await listScans({
      user: { id: "user_01", role: "admin" },
      source: "ui",
      apiKey: null,
    } as never, {
      limit: 10_000,
    });

    expect(mocks.limit).toHaveBeenCalledWith(100);
  });
});
