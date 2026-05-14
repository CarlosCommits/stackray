import { randomInt } from "node:crypto"

const UNAMBIGUOUS_BASE32_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
const TEMP_PASSWORD_LENGTH = 12

export function generateTemporaryPassword() {
  return Array.from(
    { length: TEMP_PASSWORD_LENGTH },
    () => UNAMBIGUOUS_BASE32_ALPHABET[randomInt(UNAMBIGUOUS_BASE32_ALPHABET.length)]
  ).join("")
}
