import { renderStackrayEmail } from "./layout.ts";

type TestEmailKind = "provider" | "channel";

export function buildTestEmail(kind: TestEmailKind) {
  const channelTest = kind === "channel";
  const subject = channelTest ? "Stackray alert channel test" : "Stackray email setup test";
  const title = channelTest ? "Notification channel is ready" : "Email delivery is connected";
  const intro = channelTest
    ? "Stackray successfully delivered a test notification to this channel."
    : "Stackray can now send notifications through your connected Resend account.";
  const detail = channelTest
    ? "Future alerts assigned to this channel will be delivered to its configured recipients."
    : "You can create email channels and attach them to alert policies whenever you are ready.";
  const bodyHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;border:1px solid #dceee4;border-radius:10px;background:#f2fbf6;"><tr><td style="width:28px;padding:18px 0 18px 20px;color:#14804a;font-size:22px;line-height:24px;vertical-align:top;">&#10003;</td><td style="padding:18px 20px 18px 12px;color:#285b40;font-size:14px;line-height:22px;">${detail}</td></tr></table>`;

  return {
    subject,
    html: renderStackrayEmail({
      preheader: intro,
      eyebrow: "Delivery test",
      title,
      intro,
      bodyHtml,
      footer: "This test was requested by a Stackray administrator.",
    }),
    text: [title, "", intro, "", detail, "", "This test was requested by a Stackray administrator."].join("\n"),
  };
}
