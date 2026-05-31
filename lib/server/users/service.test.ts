import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "@/lib/session/actor-context";

const selectMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const internalAdapterUpdateUserMock = vi.hoisted(() => vi.fn());
const setRoleMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: selectMock,
    update: updateMock,
  },
}));

vi.mock("@/lib/auth/better-auth", () => ({
  auth: {
    $context: Promise.resolve({
      internalAdapter: {
        updateUser: internalAdapterUpdateUserMock,
      },
    }),
    api: {
      setRole: setRoleMock,
      createUser: vi.fn(),
      requestPasswordReset: vi.fn(),
      setUserPassword: vi.fn(),
    },
  },
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

const adminActor = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@stackray.test",
    displayName: "Admin",
    image: null,
    role: "admin",
  },
  apiKeyAccessEnabled: true,
  requiresPasswordChange: false,
  source: "ui",
  apiKey: null,
} satisfies ActorContext;

describe("user service", () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
    internalAdapterUpdateUserMock.mockReset();
    setRoleMock.mockReset();
  });

  it("updates email and display name through Better Auth with normalized email", async () => {
    const { updateUser } = await import("./service");
    const targetUserId = "11111111-1111-4111-8111-111111111111";

    internalAdapterUpdateUserMock.mockResolvedValue({
      id: targetUserId,
      email: "ada.byron@example.com",
      name: "Ada Byron",
    });

    selectMock
      .mockReturnValueOnce(createQueryChain([{ email: "ada@example.com", role: "user" }]))
      .mockReturnValueOnce(createQueryChain([]))
      .mockReturnValueOnce(createQueryChain([
        {
          userId: targetUserId,
          email: "ada.byron@example.com",
          displayName: "Ada Byron",
          role: "user",
          banned: false,
          apiKeyAccessEnabled: true,
          deactivatedAt: null,
          passwordChangeRequiredAt: null,
        },
      ]))
      .mockReturnValueOnce(createQueryChain([{ id: "credential-account" }]))
      .mockReturnValueOnce(createQueryChain([]));

    await expect(
      updateUser(adminActor, targetUserId, {
        email: "Ada.Byron@Example.com",
        displayName: "Ada Byron",
      }),
    ).resolves.toMatchObject({
      userId: targetUserId,
      email: "ada.byron@example.com",
      displayName: "Ada Byron",
    });

    expect(internalAdapterUpdateUserMock).toHaveBeenCalledWith(targetUserId, {
      email: "ada.byron@example.com",
      name: "Ada Byron",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns a clean validation error when the edited email already belongs to another user", async () => {
    const { updateUser } = await import("./service");
    const targetUserId = "11111111-1111-4111-8111-111111111111";

    selectMock
      .mockReturnValueOnce(createQueryChain([{ email: "ada@example.com", role: "user" }]))
      .mockReturnValueOnce(createQueryChain([{ id: "22222222-2222-4222-8222-222222222222" }]));

    await expect(
      updateUser(adminActor, targetUserId, {
        email: "Existing@Example.com",
      }),
    ).rejects.toThrow("A user with that email already exists.");

    expect(internalAdapterUpdateUserMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
