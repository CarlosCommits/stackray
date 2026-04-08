import { randomInt } from "node:crypto"

const TEMP_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
const TEMP_PASSWORD_LENGTH = 12

export function generateTemporaryPassword() {
  return Array.from({ length: TEMP_PASSWORD_LENGTH }, () => TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)]).join("")
}
