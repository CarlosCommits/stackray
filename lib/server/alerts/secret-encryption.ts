import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "../../env/server.ts";

const ALGORITHM = "aes-256-gcm" as const;
const ENVELOPE_VERSION = 1 as const;
const DEFAULT_KEY_VERSION = 1;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const HEX_32_BYTE_PATTERN = /^[A-Fa-f0-9]{64}$/;

export type AlertSecretCryptoErrorCode =
  | "missing_key"
  | "invalid_key"
  | "invalid_plaintext"
  | "invalid_envelope"
  | "unsupported_envelope"
  | "key_version_mismatch"
  | "decryption_failed";

export class AlertSecretCryptoError extends Error {
  readonly code: AlertSecretCryptoErrorCode;

  constructor(code: AlertSecretCryptoErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AlertSecretCryptoError";
    this.code = code;
  }
}

export interface AlertSecretEnvelopeV1 {
  version: typeof ENVELOPE_VERSION;
  algorithm: typeof ALGORITHM;
  keyVersion: number;
  iv: string;
  ciphertext: string;
  authTag: string;
}

export interface StoredAlertSecret {
  secretPlaintext: string | null;
  secretCiphertext: string | null;
  secretNonce: string | null;
  secretAuthTag: string | null;
  encryptionAlgorithm: string | null;
  encryptionKeyVersion: number | null;
}

function envelopeAad(keyVersion: number) {
  return Buffer.from(`stackray:alert-secret:v${ENVELOPE_VERSION}:key-${keyVersion}`, "utf8");
}

function decodeEnvelopeField(value: unknown, expectedBytes?: number) {
  if (typeof value !== "string" || value.length === 0) {
    throw new AlertSecretCryptoError("invalid_envelope", "The encrypted alert secret is malformed.");
  }

  try {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.length === 0 || (expectedBytes !== undefined && decoded.length !== expectedBytes)) {
      throw new Error("Unexpected decoded length.");
    }
    if (decoded.toString("base64url") !== value) {
      throw new Error("The value is not canonical base64url.");
    }
    return decoded;
  } catch (error) {
    throw new AlertSecretCryptoError("invalid_envelope", "The encrypted alert secret is malformed.", { cause: error });
  }
}

export function parseAlertEncryptionKey(hexKey: string | undefined) {
  if (!hexKey) {
    throw new AlertSecretCryptoError(
      "missing_key",
      "Credential encryption is unavailable because STACKRAY_ENCRYPTION_KEY is not configured.",
    );
  }

  if (!HEX_32_BYTE_PATTERN.test(hexKey)) {
    throw new AlertSecretCryptoError(
      "invalid_key",
      "STACKRAY_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.",
    );
  }

  return Buffer.from(hexKey, "hex");
}

export function getConfiguredAlertEncryptionKey() {
  return parseAlertEncryptionKey(env.STACKRAY_ENCRYPTION_KEY);
}

export function getOptionalConfiguredAlertEncryptionKey() {
  try {
    return getConfiguredAlertEncryptionKey();
  } catch (error) {
    if (
      error instanceof AlertSecretCryptoError
      && (error.code === "missing_key" || error.code === "invalid_key")
    ) {
      return null;
    }
    throw error;
  }
}

export function encryptAlertSecret(
  plaintext: string,
  key: Uint8Array,
  options: { keyVersion?: number } = {},
): AlertSecretEnvelopeV1 {
  if (plaintext.length === 0) {
    throw new AlertSecretCryptoError("invalid_plaintext", "An alert secret cannot be empty.");
  }
  if (key.byteLength !== KEY_BYTES) {
    throw new AlertSecretCryptoError("invalid_key", "The alert encryption key must contain exactly 32 bytes.");
  }

  const keyVersion = options.keyVersion ?? DEFAULT_KEY_VERSION;
  if (!Number.isSafeInteger(keyVersion) || keyVersion <= 0) {
    throw new AlertSecretCryptoError("invalid_key", "The alert encryption key version must be a positive integer.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(envelopeAad(keyVersion));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    version: ENVELOPE_VERSION,
    algorithm: ALGORITHM,
    keyVersion,
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
  };
}

export function decryptAlertSecret(
  envelope: AlertSecretEnvelopeV1,
  key: Uint8Array,
  options: { keyVersion?: number } = {},
) {
  if (key.byteLength !== KEY_BYTES) {
    throw new AlertSecretCryptoError("invalid_key", "The alert encryption key must contain exactly 32 bytes.");
  }
  if (envelope.version !== ENVELOPE_VERSION || envelope.algorithm !== ALGORITHM) {
    throw new AlertSecretCryptoError("unsupported_envelope", "The encrypted alert secret uses an unsupported format.");
  }
  if (!Number.isSafeInteger(envelope.keyVersion) || envelope.keyVersion <= 0) {
    throw new AlertSecretCryptoError("invalid_envelope", "The encrypted alert secret is malformed.");
  }
  if (options.keyVersion !== undefined && envelope.keyVersion !== options.keyVersion) {
    throw new AlertSecretCryptoError(
      "key_version_mismatch",
      "The configured key version cannot decrypt this alert secret.",
    );
  }

  const iv = decodeEnvelopeField(envelope.iv, IV_BYTES);
  const ciphertext = decodeEnvelopeField(envelope.ciphertext);
  const authTag = decodeEnvelopeField(envelope.authTag, AUTH_TAG_BYTES);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
    decipher.setAAD(envelopeAad(envelope.keyVersion));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    throw new AlertSecretCryptoError(
      "decryption_failed",
      "The encrypted alert secret could not be decrypted. Check the configured key and stored data.",
      { cause: error },
    );
  }
}

export function protectAlertSecret(plaintext: string, key: Uint8Array | null): StoredAlertSecret {
  if (key === null) {
    return {
      secretPlaintext: plaintext,
      secretCiphertext: null,
      secretNonce: null,
      secretAuthTag: null,
      encryptionAlgorithm: null,
      encryptionKeyVersion: null,
    };
  }

  const envelope = encryptAlertSecret(plaintext, key);
  return {
    secretPlaintext: null,
    secretCiphertext: envelope.ciphertext,
    secretNonce: envelope.iv,
    secretAuthTag: envelope.authTag,
    encryptionAlgorithm: envelope.algorithm,
    encryptionKeyVersion: envelope.keyVersion,
  };
}

export function readStoredAlertSecret(storage: StoredAlertSecret, key: Uint8Array | null) {
  const envelopeValues = [
    storage.secretCiphertext,
    storage.secretNonce,
    storage.secretAuthTag,
    storage.encryptionAlgorithm,
    storage.encryptionKeyVersion,
  ];
  const hasCompleteEnvelope = envelopeValues.every((value) => value !== null);
  const hasAnyEnvelopeValue = envelopeValues.some((value) => value !== null);

  if (storage.secretPlaintext !== null) {
    if (hasAnyEnvelopeValue) {
      throw new AlertSecretCryptoError("invalid_envelope", "The credential bundle has conflicting storage modes.");
    }
    return storage.secretPlaintext;
  }

  if (!hasCompleteEnvelope) {
    throw new AlertSecretCryptoError("invalid_envelope", "No stored credential bundle was found.");
  }
  if (key === null) {
    throw new AlertSecretCryptoError(
      "missing_key",
      "This credential is encrypted, but STACKRAY_ENCRYPTION_KEY is not configured.",
    );
  }

  return decryptAlertSecret({
    version: 1,
    algorithm: storage.encryptionAlgorithm as AlertSecretEnvelopeV1["algorithm"],
    keyVersion: storage.encryptionKeyVersion as number,
    iv: storage.secretNonce as string,
    ciphertext: storage.secretCiphertext as string,
    authTag: storage.secretAuthTag as string,
  }, key);
}
