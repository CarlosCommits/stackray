import { escapeEmailHtml, renderStackrayEmail } from "./layout.ts";

type AuthEmailKind = "password-reset" | "email-verification";

export function buildAuthEmail(kind: AuthEmailKind, url: string) {
  const passwordReset = kind === "password-reset";
  const subject = passwordReset ? "Reset your Stackray password" : "Verify your Stackray email";
  const title = passwordReset ? "Reset your password" : "Verify your email address";
  const intro = passwordReset
    ? "Use the secure link below to choose a new Stackray password."
    : "Confirm this email address to finish setting up your Stackray account.";
  const actionLabel = passwordReset ? "Reset password" : "Verify email";
  const fallback = `If the button does not work, copy and paste this URL into your browser:\n${url}`;
  const bodyHtml = `<p style="margin:22px 0 0;color:#7b8493;font-size:12px;line-height:19px;word-break:break-all;">If the button does not work, copy and paste this URL into your browser:<br><span style="color:#596170;">${escapeEmailHtml(url)}</span></p>`;

  return {
    subject,
    html: renderStackrayEmail({
      preheader: intro,
      eyebrow: "Account security",
      title,
      intro,
      bodyHtml,
      action: { href: url, label: actionLabel },
      footer: "If you did not request this message, you can safely ignore it.",
    }),
    text: [title, "", intro, "", fallback, "", "If you did not request this message, you can safely ignore it."].join("\n"),
  };
}
