import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "../../db/client.ts";
import { emailProviderSettings } from "../../db/schema.ts";
import { env } from "../../env/server.ts";
import { getConfiguredResendOauthGrant } from "./oauth-grant.ts";

export const EMAIL_PROVIDER_SETTINGS_ID = "default";

export interface ConfiguredEmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export type ConfiguredEmailDeliveryResult =
  | { ok: true; providerMessageId: string | null }
  | {
      ok: false;
      category: "not_configured" | "invalid_configuration" | "rate_limited" | "provider_error";
      retryable: boolean;
      safeMessage: string;
    };

interface ResendSendResult {
  data: { id: string } | null;
  error: { statusCode?: number | null } | null;
}

export type SendConfiguredEmail = (message: {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) => Promise<ResendSendResult>;

export function formatConfiguredFromAddress(senderName: string, senderLocalPart: string, domainName: string) {
  const safeName = senderName.replace(/[\r\n]+/g, " ").replaceAll('"', "'").trim();
  return `${safeName} <${senderLocalPart}@${domainName}>`;
}

export async function getStoredEmailProviderSettings() {
  const [settings] = await db
    .select()
    .from(emailProviderSettings)
    .where(eq(emailProviderSettings.id, EMAIL_PROVIDER_SETTINGS_ID))
    .limit(1);

  return settings ?? null;
}

export async function canSendConfiguredEmail() {
  const [settings] = await db
    .select({ id: emailProviderSettings.id })
    .from(emailProviderSettings)
    .where(eq(emailProviderSettings.id, EMAIL_PROVIDER_SETTINGS_ID))
    .limit(1);

  return Boolean(settings);
}

export async function deliverConfiguredEmail(
  message: ConfiguredEmailMessage,
  options: { sendEmail?: SendConfiguredEmail } = {},
): Promise<ConfiguredEmailDeliveryResult> {
  let configuration: Awaited<ReturnType<typeof getConfiguredResendOauthGrant>>;
  try {
    configuration = await getConfiguredResendOauthGrant();
  } catch {
    return {
      ok: false,
      category: "invalid_configuration",
      retryable: false,
      safeMessage: "The saved email credential could not be read. Check STACKRAY_ENCRYPTION_KEY.",
    };
  }

  if (!configuration) {
    return {
      ok: false,
      category: "not_configured",
      retryable: false,
      safeMessage: "Email delivery is not configured.",
    };
  }

  const { accessToken, settings } = configuration;
  const resend = options.sendEmail ? null : new Resend(accessToken);
  const sendEmail = options.sendEmail ?? resend!.emails.send.bind(resend!.emails);

  try {
    const result = await sendEmail({
      from: formatConfiguredFromAddress(settings.senderName, settings.senderLocalPart, settings.domainName),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: env.AUTH_REPLY_TO_EMAIL,
    });

    if (!result.error) {
      return { ok: true, providerMessageId: result.data?.id ?? null };
    }

    const statusCode = result.error.statusCode ?? undefined;
    return statusCode === 429
      ? {
          ok: false,
          category: "rate_limited",
          retryable: true,
          safeMessage: "The email provider rate-limited the delivery request.",
        }
      : {
          ok: false,
          category: "provider_error",
          retryable: statusCode === undefined || statusCode >= 500,
          safeMessage: "The email provider rejected the delivery request.",
        };
  } catch {
    return {
      ok: false,
      category: "provider_error",
      retryable: true,
      safeMessage: "The email provider request failed before a response was received.",
    };
  }
}
