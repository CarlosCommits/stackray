import { env } from "../../../env/server.ts";

export type StackrayEmailAction = {
  href: string;
  label: string;
};

type StackrayEmailLayoutInput = {
  preheader: string;
  eyebrow?: string;
  title: string;
  intro: string;
  bodyHtml?: string;
  action?: StackrayEmailAction;
  footer?: string;
  assetOrigin?: string;
};

export function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailAssetOrigin(override?: string) {
  if (override) {
    return new URL(override).origin;
  }
  if (env.BETTER_AUTH_URL) {
    return new URL(env.BETTER_AUTH_URL).origin;
  }
  if (env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return "https://stackray.app";
}

export function emailAssetUrl(path: string, origin?: string) {
  return new URL(path, `${emailAssetOrigin(origin)}/`).toString();
}

export function renderStackrayEmail(input: StackrayEmailLayoutInput) {
  const brandMarkUrl = escapeEmailHtml(emailAssetUrl("/email-assets/stackray-mark.png", input.assetOrigin));
  const geistRegularUrl = escapeEmailHtml(emailAssetUrl("/email-assets/geist-regular.woff2", input.assetOrigin));
  const geistSemiboldUrl = escapeEmailHtml(emailAssetUrl("/email-assets/geist-semibold.woff2", input.assetOrigin));
  const eyebrow = input.eyebrow
    ? `<p style="margin:0 0 13px;color:#9a6700;font-size:11px;font-weight:700;letter-spacing:0.14em;line-height:17px;text-transform:uppercase;">${escapeEmailHtml(input.eyebrow)}</p>`
    : "";
  const action = input.action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 0;"><tr><td style="border:1px solid #dda91e;border-radius:9px;background:#f5bd2e;"><a href="${escapeEmailHtml(input.action.href)}" style="display:inline-block;padding:12px 20px;color:#17191d;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:20px;text-decoration:none;">${escapeEmailHtml(input.action.label)}</a></td></tr></table>`
    : "";
  const footer = input.footer ?? "You received this message because Stackray is configured to send email notifications.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeEmailHtml(input.title)}</title>
    <style>
      @font-face {
        font-family: "Geist Email";
        font-style: normal;
        font-weight: 400;
        src: url("${geistRegularUrl}") format("woff2");
      }
      @font-face {
        font-family: "Geist Email";
        font-style: normal;
        font-weight: 600;
        src: url("${geistSemiboldUrl}") format("woff2");
      }
      @media only screen and (max-width: 480px) {
        .stackray-email-shell { padding: 24px 12px !important; }
        .stackray-email-content { padding: 32px 22px 30px !important; }
        .stackray-email-footer { padding: 18px 22px 20px !important; }
        .stackray-change-category { display: none !important; }
        .stackray-change-icon-cell { width: 42px !important; padding-right: 10px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f4f5f6;color:#17191d;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeEmailHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f5f6;">
      <tr>
        <td align="center" class="stackray-email-shell" style="padding:42px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;">
            <tr>
              <td style="padding:0 4px 17px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="width:38px;height:38px;vertical-align:middle;"><img src="${brandMarkUrl}" width="38" height="38" alt="" style="display:block;width:38px;height:38px;border:0;outline:none;text-decoration:none;"></td>
                    <td style="padding-left:9px;color:#17191d;font-family:'Geist Email','Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:600;letter-spacing:-0.035em;vertical-align:middle;">Stackray</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="overflow:hidden;border:1px solid #dfe2e7;border-radius:16px;background:#ffffff;box-shadow:0 10px 28px rgba(17,24,39,0.045);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="stackray-email-content" style="padding:42px 44px 36px;">
                      ${eyebrow}
                      <h1 style="margin:0;color:#17191d;font-family:'Geist Email','Helvetica Neue',Arial,sans-serif;font-size:29px;font-weight:600;letter-spacing:-0.035em;line-height:35px;">${escapeEmailHtml(input.title)}</h1>
                      <p style="margin:14px 0 0;color:#596170;font-size:15px;line-height:24px;">${escapeEmailHtml(input.intro)}</p>
                      ${input.bodyHtml ?? ""}
                      ${action}
                    </td>
                  </tr>
                  <tr>
                    <td class="stackray-email-footer" style="border-top:1px solid #eceef1;padding:20px 44px 22px;color:#7b8493;font-size:12px;line-height:18px;">${escapeEmailHtml(footer)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 24px 0;color:#9299a5;font-size:11px;line-height:17px;">Open-source website intelligence and change monitoring.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
