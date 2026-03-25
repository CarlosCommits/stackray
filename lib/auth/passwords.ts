import { randomBytes } from "node:crypto";

export function generateTemporaryPassword(length = 18) {
  const raw = randomBytes(length).toString("base64url");
  return `${raw}A9!`;
}
