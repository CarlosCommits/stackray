import { eq, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db/client.ts";
import { emailProviderSettings, resendOauthSetupSessions } from "../../db/schema.ts";
import {
  getOptionalConfiguredAlertEncryptionKey,
  protectAlertSecret,
  readStoredAlertSecret,
} from "../alerts/secret-encryption.ts";
import { refreshResendOauthToken, revokeResendOauthGrant } from "./resend-oauth.ts";

export const resendOauthTokenBundleSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

const EMAIL_PROVIDER_SETTINGS_ID = "default";
const RESEND_REFRESH_LOCK_KEY = "stackray:resend-oauth-refresh";

export function assertUsableResendOauthScope(scope: string) {
  const grantedScopes = new Set(scope.split(/\s+/).filter(Boolean));
  if (!grantedScopes.has("emails:send") && !grantedScopes.has("full_access")) {
    throw new Error("Resend did not grant permission to send email. Reconnect and choose Sending access.");
  }
}

export function serializeResendOauthTokenBundle(bundle: z.infer<typeof resendOauthTokenBundleSchema>) {
  return JSON.stringify(bundle);
}

export function parseResendOauthTokenBundle(serialized: string) {
  return resendOauthTokenBundleSchema.parse(JSON.parse(serialized));
}

export async function getConfiguredResendOauthGrant(options: { forceRefresh?: boolean } = {}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${RESEND_REFRESH_LOCK_KEY}))`);

    const [settings] = await tx
      .select()
      .from(emailProviderSettings)
      .where(eq(emailProviderSettings.id, EMAIL_PROVIDER_SETTINGS_ID))
      .limit(1);
    if (!settings) return null;

    const key = getOptionalConfiguredAlertEncryptionKey();
    const serialized = readStoredAlertSecret(settings, key);
    const bundle = parseResendOauthTokenBundle(serialized);
    const shouldRefresh = options.forceRefresh === true
      || settings.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;

    if (!shouldRefresh) {
      if (settings.secretPlaintext !== null && key !== null) {
        await tx.update(emailProviderSettings).set({
          ...protectAlertSecret(serialized, key),
          updatedAt: new Date(),
        }).where(eq(emailProviderSettings.id, EMAIL_PROVIDER_SETTINGS_ID));
      }
      return { settings, accessToken: bundle.accessToken };
    }

    const refreshed = await refreshResendOauthToken(settings.oauthClientId, bundle.refreshToken);
    assertUsableResendOauthScope(refreshed.scope);
    const nextBundle = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
    };
    const accessTokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1_000);
    const [updated] = await tx.update(emailProviderSettings).set({
      oauthScope: refreshed.scope,
      accessTokenExpiresAt,
      ...protectAlertSecret(serializeResendOauthTokenBundle(nextBundle), key),
      updatedAt: new Date(),
    }).where(eq(emailProviderSettings.id, EMAIL_PROVIDER_SETTINGS_ID)).returning();

    return { settings: updated, accessToken: nextBundle.accessToken };
  });
}

export async function refreshConfiguredResendOauthGrant() {
  return getConfiguredResendOauthGrant({ forceRefresh: true });
}

export async function cleanupExpiredResendOauthSetupSessions() {
  const expiredSessions = await db
    .select()
    .from(resendOauthSetupSessions)
    .where(lt(resendOauthSetupSessions.expiresAt, new Date()))
    .limit(100);
  const key = getOptionalConfiguredAlertEncryptionKey();
  let removed = 0;

  for (const session of expiredSessions) {
    try {
      const bundle = parseResendOauthTokenBundle(readStoredAlertSecret(session, key));
      await revokeResendOauthGrant(session.clientId, bundle.refreshToken);
      await db.delete(resendOauthSetupSessions).where(eq(resendOauthSetupSessions.id, session.id));
      removed += 1;
    } catch {
      // Keep the row so a transient provider or encryption failure can be retried.
    }
  }

  return removed;
}
