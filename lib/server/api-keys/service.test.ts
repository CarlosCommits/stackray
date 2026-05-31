import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "@/lib/session/actor-context";

const selectMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: selectMock,
    update: updateMock,
    delete: deleteMock,
  },
}));

vi.mock("@/lib/authorization/authz", () => ({
  canAccessApiKeys: () => true,
}));

function createQueryChain<T>(result: T) {
  const promise = Promise.resolve(result);
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    set: vi.fn(() => chain),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
    [Symbol.toStringTag]: "Promise",
  };

  return chain;
}

const actor = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "operator@stackray.test",
    displayName: "Operator",
    image: null,
    role: "user",
  },
  apiKeyAccessEnabled: true,
  requiresPasswordChange: false,
  source: "ui",
  apiKey: null,
} satisfies ActorContext;

describe("api key service", () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
  });

  it("soft-revokes API keys instead of deleting attribution rows", async () => {
    const { revokeApiKey } = await import("./service");
    const selectChain = createQueryChain([{ id: "00000000-0000-4000-8000-000000000123" }]);
    const updateChain = createQueryChain([]);
    selectMock.mockReturnValueOnce(selectChain);
    updateMock.mockReturnValueOnce(updateChain);

    await expect(revokeApiKey(actor, "00000000-0000-4000-8000-000000000123")).resolves.toEqual({
      revokedApiKeyId: "00000000-0000-4000-8000-000000000123",
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateChain.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("only lists active API keys", async () => {
    const { listApiKeys } = await import("./service");
    const listChain = createQueryChain([
      {
        id: "00000000-0000-4000-8000-000000000123",
        name: "Local API client",
        keyHint: "sr_live_1234",
        lastUsedAt: null,
        createdAt: new Date("2026-05-30T12:00:00.000Z"),
      },
    ]);
    selectMock.mockReturnValueOnce(listChain);

    await expect(listApiKeys(actor)).resolves.toEqual({
      items: [
        {
          id: "00000000-0000-4000-8000-000000000123",
          name: "Local API client",
          keyHint: "sr_live_1234",
          lastUsedAt: null,
          createdAt: "2026-05-30T12:00:00.000Z",
        },
      ],
    });

    expect(listChain.where).toHaveBeenCalledTimes(1);
  });
});
