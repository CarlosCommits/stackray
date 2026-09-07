import { randomBytes } from "node:crypto";

import { z } from "zod";

const querySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const payload = parsed.success
    ? {
        type: "stackray:slack-oauth",
        code: parsed.data.code ?? null,
        state: parsed.data.state ?? null,
        error: parsed.data.error ?? null,
      }
    : { type: "stackray:slack-oauth", code: null, state: null, error: "invalid_callback" };
  const serializedPayload = JSON.stringify(payload).replaceAll("<", "\\u003c");
  const nonce = randomBytes(18).toString("base64url");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Return to Stackray</title>
    <style>
      :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; background: #0d1117; color: #f4f4f5; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; }
      main { width: min(28rem, calc(100vw - 2rem)); border: 1px solid #2a3038; border-radius: 1rem; background: #151a21; padding: 2rem; text-align: center; box-sizing: border-box; }
      h1 { margin: 0 0 .75rem; font-size: 1.25rem; }
      p { margin: 0; color: #a8b0bb; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main><h1>Returning to Stackray</h1><p id="status">Completing your Slack connection…</p></main>
    <script nonce="${nonce}">
      const payload = ${serializedPayload};
      const status = document.getElementById("status");
      if (window.opener) {
        window.opener.postMessage(payload, "*");
        status.textContent = "You can close this window.";
        window.setTimeout(() => window.close(), 250);
      } else {
        status.textContent = "Return to the Stackray tab that opened this window. If it did not update, add the Slack webhook manually.";
      }
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`,
      "content-type": "text/html; charset=utf-8",
      "cross-origin-opener-policy": "unsafe-none",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}
