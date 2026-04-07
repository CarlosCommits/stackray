import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "sr_live_";

export function generateApiToken() {
  return `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function hashApiToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function getApiTokenHint(rawToken: string) {
  return rawToken.slice(0, 14);
}
