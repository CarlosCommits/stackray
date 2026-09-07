// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canSendAlertEmail: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: mocks.select,
    transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/server/alerts/email-delivery", () => ({
  canSendAlertEmail: mocks.canSendAlertEmail,
  deliverAlertEmail: vi.fn(),
}));

import type { ActorContext } from "@/lib/session/actor-context";
import { createAlertChannel, createAlertPolicy } from "./service.ts";

const actor = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@stackray.test",
    displayName: "Admin",
    image: null,
    role: "admin",
  },
  apiKeyAccessEnabled: false,
  requiresPasswordChange: false,
  source: "ui",
  apiKey: null,
} satisfies ActorContext;

function createQueryChain<T>(result: T) {
  const chain = {
    from: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    where: vi.fn(() => chain),
    then: <TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain;
}

function fullCapacityTransaction() {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn(),
    select: vi.fn(() => createQueryChain(Array.from({ length: 100 }, (_, index) => ({ id: `item_${index}` })))),
  };
}

describe("alert settings capacity", () => {
  beforeEach(() => {
    mocks.canSendAlertEmail.mockReset().mockResolvedValue(true);
    mocks.select.mockReset();
    mocks.transaction.mockReset();
  });

  it("rejects a channel beyond the bounded list capacity", async () => {
    const transaction = fullCapacityTransaction();
    mocks.transaction.mockImplementation(async (callback) => callback(transaction));

    await expect(createAlertChannel(actor, {
      displayName: "Email",
      channelType: "email",
      recipients: ["admin@example.com"],
      enabled: true,
    })).rejects.toThrow("up to 100 saved notification channels");
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  it("rejects a policy beyond the bounded list capacity", async () => {
    mocks.select.mockReturnValue(createQueryChain([{ id: "11111111-1111-4111-8111-111111111111" }]));
    const transaction = fullCapacityTransaction();
    mocks.transaction.mockImplementation(async (callback) => callback(transaction));

    await expect(createAlertPolicy(actor, {
      name: "Policy",
      state: "enabled",
      coverage: "all_targets",
      conditions: { selectionMode: "all", changeTypes: [] },
      cooldownSeconds: 0,
      channelIds: ["11111111-1111-4111-8111-111111111111"],
      targetIds: [],
    })).rejects.toThrow("up to 100 saved alert policies");
    expect(transaction.insert).not.toHaveBeenCalled();
  });
});
