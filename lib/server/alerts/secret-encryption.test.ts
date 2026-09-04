import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  AlertSecretCryptoError,
  decryptAlertSecret,
  encryptAlertSecret,
  parseAlertEncryptionKey,
  protectAlertSecret,
  readStoredAlertSecret,
} from "@/lib/server/alerts/secret-encryption";

function expectCryptoCode(action: () => unknown, code: AlertSecretCryptoError["code"]) {
  try {
    action();
    throw new Error("Expected the action to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(AlertSecretCryptoError);
    expect((error as AlertSecretCryptoError).code).toBe(code);
  }
}

describe("alert secret encryption", () => {
  it("accepts only 64 hexadecimal characters containing exactly 32 bytes", () => {
    const key = randomBytes(32);
    const hexKey = key.toString("hex");

    expect(parseAlertEncryptionKey(hexKey)).toEqual(key);
    expect(parseAlertEncryptionKey(hexKey.toUpperCase())).toEqual(key);

    expectCryptoCode(() => parseAlertEncryptionKey(undefined), "missing_key");
    expectCryptoCode(() => parseAlertEncryptionKey(""), "missing_key");
    expectCryptoCode(() => parseAlertEncryptionKey(randomBytes(31).toString("hex")), "invalid_key");
    expectCryptoCode(() => parseAlertEncryptionKey(`${hexKey}0`), "invalid_key");
    expectCryptoCode(() => parseAlertEncryptionKey(key.toString("base64")), "invalid_key");
    expectCryptoCode(() => parseAlertEncryptionKey("g".repeat(64)), "invalid_key");
    expectCryptoCode(() => parseAlertEncryptionKey(` ${hexKey}`), "invalid_key");
  });

  it("round trips a secret in a versioned authenticated envelope", () => {
    const key = randomBytes(32);
    const secret = "Bearer webhook-secret-🔐";
    const envelope = encryptAlertSecret(secret, key, { keyVersion: 7 });

    expect(envelope).toMatchObject({
      version: 1,
      algorithm: "aes-256-gcm",
      keyVersion: 7,
    });
    expect(JSON.stringify(envelope)).not.toContain(secret);
    expect(decryptAlertSecret(envelope, key, { keyVersion: 7 })).toBe(secret);
    expect(encryptAlertSecret(secret, key).ciphertext).not.toBe(envelope.ciphertext);
  });

  it("stores and reads plaintext secrets when no encryption key is configured", () => {
    const secret = JSON.stringify({ endpoint: "https://hooks.example.test/stackray" });
    const storage = protectAlertSecret(secret, null);

    expect(storage).toMatchObject({
      secretPlaintext: secret,
      secretCiphertext: null,
      encryptionAlgorithm: null,
    });
    expect(readStoredAlertSecret(storage, null)).toBe(secret);
  });

  it("stores encrypted secrets when a key is configured", () => {
    const key = randomBytes(32);
    const secret = JSON.stringify({ endpoint: "https://hooks.example.test/stackray" });
    const storage = protectAlertSecret(secret, key);

    expect(storage.secretPlaintext).toBeNull();
    expect(storage.secretCiphertext).not.toContain(secret);
    expect(readStoredAlertSecret(storage, key)).toBe(secret);
    expectCryptoCode(() => readStoredAlertSecret(storage, null), "missing_key");
  });

  it("rejects incomplete or conflicting stored secret modes", () => {
    const plaintextStorage = protectAlertSecret("secret", null);

    expectCryptoCode(
      () => readStoredAlertSecret({ ...plaintextStorage, secretCiphertext: "unexpected" }, null),
      "invalid_envelope",
    );
    expectCryptoCode(
      () => readStoredAlertSecret({ ...plaintextStorage, secretPlaintext: null }, null),
      "invalid_envelope",
    );
  });

  it("rejects the wrong key, tampering, and a mismatched key version", () => {
    const key = randomBytes(32);
    const envelope = encryptAlertSecret("https://hooks.example.test/token", key, { keyVersion: 3 });
    const ciphertext = Buffer.from(envelope.ciphertext, "base64url");
    ciphertext[0] ^= 1;

    expectCryptoCode(() => decryptAlertSecret(envelope, randomBytes(32)), "decryption_failed");
    expectCryptoCode(
      () => decryptAlertSecret({ ...envelope, ciphertext: ciphertext.toString("base64url") }, key),
      "decryption_failed",
    );
    expectCryptoCode(() => decryptAlertSecret(envelope, key, { keyVersion: 2 }), "key_version_mismatch");
  });

  it("rejects malformed and unsupported envelopes without exposing ciphertext", () => {
    const key = randomBytes(32);
    const envelope = encryptAlertSecret("secret", key);

    expectCryptoCode(
      () => decryptAlertSecret({ ...envelope, authTag: "not-base64url!" }, key),
      "invalid_envelope",
    );
    expectCryptoCode(
      () => decryptAlertSecret({ ...envelope, version: 2 } as unknown as typeof envelope, key),
      "unsupported_envelope",
    );
  });
});
