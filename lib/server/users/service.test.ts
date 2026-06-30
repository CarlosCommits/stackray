import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "@/lib/session/actor-context";

const selectMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn());
const internalAdapterUpdateUserMock = vi.hoisted(() => vi.fn());
const setRoleMock = vi.hoisted(() => vi.fn());
const createUserMock = vi.hoisted(() => vi.fn());
const requestPasswordResetMock = vi.hoisted(() => vi.fn());
const setUserPasswordMock = vi.hoisted(() => vi.fn());
const generateTemporaryPasswordMock = vi.hoisted(() => vi.fn(() => "generated-temp-password"));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: selectMock,
    update: updateMock,
    transaction: transactionMock,
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
      createUser: createUserMock,
      requestPasswordReset: requestPasswordResetMock,
      setUserPassword: setUserPasswordMock,
    },
  },
}));

vi.mock("@/lib/auth/passwords", () => ({
  generateTemporaryPassword: generateTemporaryPasswordMock,
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
    deleteMock.mockReset();
    transactionMock.mockReset();
    internalAdapterUpdateUserMock.mockReset();
    setRoleMock.mockReset();
    createUserMock.mockReset();
    requestPasswordResetMock.mockReset();
    setUserPasswordMock.mockReset();
    generateTemporaryPasswordMock.mockReturnValue("generated-temp-password");
    transactionMock.mockImplementation(async (callback) => callback({
      update: updateMock,
      delete: deleteMock,
    }));
  });

  it("sets API key access while creating a non-admin user", async () => {
    const { createUser } = await import("./service");
    const targetUserId = "11111111-1111-4111-8111-111111111111";
    const updateChain = createQueryChain([]);

    createUserMock.mockResolvedValue({
      user: {
        id: targetUserId,
      },
    });
    updateMock.mockReturnValueOnce(updateChain);
    selectMock
      .mockReturnValueOnce(createQueryChain([
        {
          userId: targetUserId,
          email: "ada@example.com",
          displayName: "Ada Lovelace",
          role: "user",
          banned: false,
          apiKeyAccessEnabled: false,
          deactivatedAt: null,
          passwordChangeRequiredAt: new Date("2026-03-23T14:00:00.000Z"),
        },
      ]))
      .mockReturnValueOnce(createQueryChain([{ id: "credential-account" }]))
      .mockReturnValueOnce(createQueryChain([]));

    await expect(
      createUser(adminActor, {
        email: "ada@example.com",
        displayName: "Ada Lovelace",
        role: "user",
        apiKeyAccessEnabled: false,
        deliveryMode: "temp-password",
      }),
    ).resolves.toMatchObject({
      user: {
        userId: targetUserId,
        apiKeyAccessEnabled: false,
      },
    });

    expect(createUserMock).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        email: "ada@example.com",
        name: "Ada Lovelace",
        role: "user",
      }),
    }));
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      apiKeyAccessEnabled: false,
    }));
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

  it("persists API key access when promoting a user to admin", async () => {
    const { updateUser } = await import("./service");
    const targetUserId = "11111111-1111-4111-8111-111111111111";
    const updateChain = createQueryChain([]);

    updateMock.mockReturnValueOnce(updateChain);
    selectMock
      .mockReturnValueOnce(createQueryChain([{ email: "ada@example.com", role: "user" }]))
      .mockReturnValueOnce(createQueryChain([
        {
          userId: targetUserId,
          email: "ada@example.com",
          displayName: "Ada Lovelace",
          role: "admin",
          banned: false,
          apiKeyAccessEnabled: false,
          deactivatedAt: null,
          passwordChangeRequiredAt: null,
        },
      ]))
      .mockReturnValueOnce(createQueryChain([{ id: "credential-account" }]))
      .mockReturnValueOnce(createQueryChain([]));

    await expect(
      updateUser(adminActor, targetUserId, {
        role: "admin",
      }),
    ).resolves.toMatchObject({
      userId: targetUserId,
      role: "admin",
      apiKeyAccessEnabled: true,
    });

    expect(setRoleMock).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        userId: targetUserId,
        role: "admin",
      },
    }));
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      apiKeyAccessEnabled: true,
      updatedAt: expect.any(Date),
    }));
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

  it("resets a user to a temporary password and requires a password change", async () => {
    const { resetUserPassword } = await import("./service");
    const targetUserId = "11111111-1111-4111-8111-111111111111";
    const updateChain = createQueryChain([]);
    const deleteChain = createQueryChain([]);

    updateMock.mockReturnValueOnce(updateChain);
    deleteMock.mockReturnValueOnce(deleteChain);
    selectMock
      .mockReturnValueOnce(createQueryChain([
        {
          userId: targetUserId,
          email: "ada@example.com",
          displayName: "Ada Lovelace",
          role: "user",
          banned: false,
          apiKeyAccessEnabled: true,
          deactivatedAt: null,
          passwordChangeRequiredAt: null,
        },
      ]))
      .mockReturnValueOnce(createQueryChain([{ id: "credential-account" }]))
      .mockReturnValueOnce(createQueryChain([]));

    await expect(resetUserPassword(adminActor, targetUserId, "temp-password")).resolves.toMatchObject({
      temporaryPassword: "generated-temp-password",
      deliveredByEmail: false,
    });

    expect(setUserPasswordMock).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        userId: targetUserId,
        newPassword: "generated-temp-password",
      },
    }));
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      passwordChangeRequiredAt: expect.any(Date),
      updatedAt: expect.any(Date),
    }));
    expect(deleteChain.where).toHaveBeenCalled();
  });

  it("rejects temporary password resets from non-admin users", async () => {
    const { resetUserPassword } = await import("./service");
    const viewerActor = {
      ...adminActor,
      user: {
        ...adminActor.user,
        role: "viewer" as const,
      },
    };

    await expect(resetUserPassword(viewerActor, "11111111-1111-4111-8111-111111111111", "temp-password")).rejects.toThrow(
      "You do not have permission to manage users.",
    );

    expect(setUserPasswordMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects temporary password resets for the current admin account", async () => {
    const { resetUserPassword } = await import("./service");

    selectMock
      .mockReturnValueOnce(createQueryChain([
        {
          userId: adminActor.user.id,
          email: adminActor.user.email,
          displayName: adminActor.user.displayName,
          role: "admin",
          banned: false,
          apiKeyAccessEnabled: true,
          deactivatedAt: null,
          passwordChangeRequiredAt: null,
        },
      ]))
      .mockReturnValueOnce(createQueryChain([{ id: "credential-account" }]))
      .mockReturnValueOnce(createQueryChain([]));

    await expect(resetUserPassword(adminActor, adminActor.user.id, "temp-password")).rejects.toThrow(
      "Use your account settings to change your own password.",
    );

    expect(setUserPasswordMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects email password resets for the current admin account", async () => {
    const { resetUserPassword } = await import("./service");

    selectMock
      .mockReturnValueOnce(createQueryChain([
        {
          userId: adminActor.user.id,
          email: adminActor.user.email,
          displayName: adminActor.user.displayName,
          role: "admin",
          banned: false,
          apiKeyAccessEnabled: true,
          deactivatedAt: null,
          passwordChangeRequiredAt: null,
        },
      ]))
      .mockReturnValueOnce(createQueryChain([{ id: "credential-account" }]))
      .mockReturnValueOnce(createQueryChain([]));

    await expect(resetUserPassword(adminActor, adminActor.user.id, "email")).rejects.toThrow(
      "Use your account settings to change your own password.",
    );

    expect(requestPasswordResetMock).not.toHaveBeenCalled();
    expect(setUserPasswordMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
