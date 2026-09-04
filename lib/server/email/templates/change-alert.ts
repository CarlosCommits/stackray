import type { AlertWebhookPayload } from "../../alerts/webhook-payload.ts";
import { getEmailChangeIconFilename } from "../../../changes/change-visuals.ts";
import {
  emailAssetUrl,
  escapeEmailHtml,
  renderStackrayEmail,
} from "./layout.ts";

type ChangeAlertEmailOptions = {
  assetOrigin?: string;
};

function categoryLabel(category: string) {
  if (category.toLowerCase() === "tls") return "TLS";
  return category
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function changeRows(payload: AlertWebhookPayload, assetOrigin?: string) {
  return payload.changes.map((change, index) => {
    const detail = change.preview ?? change.endpoint;
    const detailHtml = detail
      ? `<div style="margin-top:4px;color:#707887;font-size:12px;font-weight:400;line-height:18px;word-break:break-word;">${escapeEmailHtml(detail)}</div>`
      : "";
    const iconUrl = escapeEmailHtml(emailAssetUrl(
      `/email-assets/change-icons/${getEmailChangeIconFilename(change.type)}`,
      assetOrigin,
    ));
    const border = index === 0 ? "" : "border-top:1px solid #eceef1;";

    return `<tr><td style="${border}padding:17px 18px;vertical-align:top;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="stackray-change-icon-cell" style="width:46px;padding-right:12px;vertical-align:top;"><img src="${iconUrl}" width="34" height="34" alt="" style="display:block;width:34px;height:34px;border:0;outline:none;text-decoration:none;"></td><td style="color:#252a32;font-size:14px;font-weight:700;line-height:20px;vertical-align:top;">${escapeEmailHtml(change.summary)}${detailHtml}</td><td align="right" class="stackray-change-category" style="padding-left:16px;color:#858c98;font-size:10px;font-weight:700;letter-spacing:0.09em;line-height:19px;text-transform:uppercase;white-space:nowrap;vertical-align:top;">${escapeEmailHtml(categoryLabel(change.category))}</td></tr></table></td></tr>`;
  }).join("");
}

export function buildChangeAlertEmail(
  payload: AlertWebhookPayload,
  options: ChangeAlertEmailOptions = {},
) {
  const count = payload.summary.includedChanges;
  const changeLabel = `${count} ${count === 1 ? "change" : "changes"}`;
  const subject = `[Stackray] ${payload.summary.headline} on ${payload.target.label}`;
  const intro = `${changeLabel} matched an alert policy for ${payload.target.label}.`;
  const targetUrl = escapeEmailHtml(payload.target.url);
  const bodyHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;"><tr><td style="border:1px solid #e3e6ea;border-radius:11px;background:#f8f9fa;padding:15px 17px;"><div style="color:#858c98;font-size:10px;font-weight:700;letter-spacing:0.1em;line-height:16px;text-transform:uppercase;">Monitored site</div><div style="margin-top:3px;color:#252a32;font-size:15px;font-weight:700;line-height:21px;">${escapeEmailHtml(payload.target.label)}</div><div style="margin-top:2px;color:#7b8493;font-size:12px;line-height:18px;word-break:break-all;">${targetUrl}</div></td></tr></table><div style="margin:27px 0 9px;color:#596170;font-size:12px;font-weight:700;letter-spacing:0.02em;line-height:18px;">Changes in this alert</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e3e6ea;border-radius:12px;border-collapse:separate;overflow:hidden;">${changeRows(payload, options.assetOrigin)}</table>`;
  const changeLines = payload.changes.map((change) => [
    `- ${change.summary}`,
    ...(change.preview ? [`  ${change.preview}`] : change.endpoint ? [`  ${change.endpoint}`] : []),
  ].join("\n"));

  return {
    subject,
    html: renderStackrayEmail({
      preheader: `${intro} Review the comparison in Stackray.`,
      eyebrow: "Change alert",
      title: payload.summary.headline,
      intro,
      bodyHtml,
      action: { href: payload.comparison.url, label: "Review changes" },
      assetOrigin: options.assetOrigin,
    }),
    text: [
      payload.summary.headline,
      "",
      intro,
      payload.target.url,
      "",
      ...changeLines,
      "",
      `Review changes: ${payload.comparison.url}`,
    ].join("\n"),
  };
}
