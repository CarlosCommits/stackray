import { eq } from "drizzle-orm";

import { db } from "../db/client.ts";
import { instanceRuntimeSettings } from "../db/schema.ts";

const INSTANCE_RUNTIME_SETTINGS_ID = "default";

function normalizeStoredOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isMissingRuntimeSettingsRelation(error: unknown) {
  let current: unknown = error;

  while (current instanceof Error) {
    const databaseError = current as Error & { code?: string; cause?: unknown };

    if (databaseError.code === "42P01") {
      return true;
    }

    current = databaseError.cause;
  }

  return false;
}

export class InstancePublicOriginUnavailableError extends Error {
  constructor() {
    super("The Stackray website public origin has not been registered yet.");
    this.name = "InstancePublicOriginUnavailableError";
  }
}

export async function registerInstancePublicOrigin(value: string) {
  const publicOrigin = normalizeStoredOrigin(value);

  if (!publicOrigin) {
    throw new Error("Cannot register an invalid Stackray public origin.");
  }

  const now = new Date();
  await db.insert(instanceRuntimeSettings).values({
    id: INSTANCE_RUNTIME_SETTINGS_ID,
    publicOrigin,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: instanceRuntimeSettings.id,
    set: {
      publicOrigin,
      updatedAt: now,
    },
  });
}

export async function getRequiredInstancePublicOrigin() {
  let settings: { publicOrigin: string } | undefined;

  try {
    [settings] = await db
      .select({ publicOrigin: instanceRuntimeSettings.publicOrigin })
      .from(instanceRuntimeSettings)
      .where(eq(instanceRuntimeSettings.id, INSTANCE_RUNTIME_SETTINGS_ID))
      .limit(1);
  } catch (error) {
    if (isMissingRuntimeSettingsRelation(error)) {
      throw new InstancePublicOriginUnavailableError();
    }

    throw error;
  }

  const publicOrigin = settings ? normalizeStoredOrigin(settings.publicOrigin) : null;

  if (!publicOrigin) {
    throw new InstancePublicOriginUnavailableError();
  }

  return publicOrigin;
}
