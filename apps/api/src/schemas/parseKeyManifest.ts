import type {
  KeyManifestMap,
  KeyManifestRecipientPayload,
} from '@encrypt/core/types/manifest';
import { badRequest } from '../lib/httpError.js';

function requireString(value: unknown, field: string, mapKey: string): string {
  if (typeof value !== 'string' || !value) {
    throw badRequest(
      `keyManifest["${mapKey}"].${field} must be a non-empty string.`,
    );
  }
  return value;
}

/** Parse AJV-validated wire keyManifest into a typed map for DB writes. */
export function parseKeyManifest(
  wire: Record<string, Record<string, unknown>>,
): KeyManifestMap {
  const entries = Object.entries(wire);
  if (entries.length === 0) {
    throw badRequest('keyManifest must include at least one recipient.');
  }

  const result: KeyManifestMap = {};

  for (const [mapKey, entry] of entries) {
    if (!entry || typeof entry !== 'object') {
      throw badRequest(`keyManifest["${mapKey}"] must be an object.`);
    }

    const keyId = requireString(entry.keyId, 'keyId', mapKey);
    if (keyId !== mapKey) {
      throw badRequest(
        `keyManifest map key "${mapKey}" does not match entry.keyId "${keyId}".`,
      );
    }

    const payload: KeyManifestRecipientPayload = {
      keyId,
      iv: requireString(entry.iv, 'iv', mapKey),
      salt: requireString(entry.salt, 'salt', mapKey),
      encryptedDek: requireString(entry.encryptedDek, 'encryptedDek', mapKey),
    };

    if (entry.publicKey !== undefined) {
      if (typeof entry.publicKey !== 'object' || entry.publicKey === null) {
        throw badRequest(
          `keyManifest["${mapKey}"].publicKey must be a JWK object.`,
        );
      }
      payload.publicKey = entry.publicKey as JsonWebKey;
    }

    result[mapKey] = payload;
  }

  return result;
}
