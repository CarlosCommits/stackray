import { canSendConfiguredEmail, deliverConfiguredEmail } from "@/lib/server/email/provider";

interface AuthEmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export const canSendAuthEmail = canSendConfiguredEmail;

export async function sendAuthEmail(message: AuthEmailMessage) {
  const result = await deliverConfiguredEmail(message);
  if (!result.ok) throw new Error(result.safeMessage);
}
