import { Resend } from "resend";

import { env } from "@/lib/env/server";

interface AuthEmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let resendClient: Resend | null = null;

export function canSendAuthEmail() {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}

function getResendClient() {
  if (!env.RESEND_API_KEY) {
    throw new Error("Resend is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}

export async function sendAuthEmail(message: AuthEmailMessage) {
  if (!canSendAuthEmail()) {
    throw new Error("Email delivery is not configured.");
  }

  await getResendClient().emails.send({
    from: env.RESEND_FROM_EMAIL!,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: env.AUTH_REPLY_TO_EMAIL,
  });
}
