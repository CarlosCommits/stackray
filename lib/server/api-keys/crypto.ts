import { createHash, randomBytes } from "node:crypto";

const API_KEY_PREFIX = "sr_live_";

export function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function hashApiKey(rawApiKey: string) {
  return createHash("sha256").update(rawApiKey).digest("hex");
}

export function getApiKeyHint(rawApiKey: string) {
  return rawApiKey.slice(0, 14);
}
