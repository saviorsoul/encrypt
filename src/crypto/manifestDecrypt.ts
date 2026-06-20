import { logError } from '@/utils/logError.ts';
import { base64ToBytes } from '@/utils/bytes.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import type {
  KeyManifestRecipientPayload,
  ManifestCorePayload,
  ManifestEncryptedContentSignableBody,
  ManifestPayload,
  ManifestSignableBody,
} from '@/types/manifest.ts';
import { MANIFEST_VERSION, MANIFEST_WRAP } from '@/crypto/manifestConstants.ts';
import {
  deriveAesGcmKekFromHkdfMaterial,
  deriveEcdhSharedSecretBits,
  importSharedSecretAsHkdfKeyMaterial,
} from '@/crypto/manifestEncrypt.ts';
import { verifyManifestSignature } from '@/crypto/manifestSign.ts';
import {
  assembleManifestForRecipient,
  parseManifestCorePayload,
} from '@/crypto/manifestStorage.ts';
import { getMessageKeyManifestEntry } from '@/services/db/storedMessageKeyManifest.ts';
import { parseBaseJsonObjectOrThrow } from '@/utils/validateBaseJsonText.ts';

export function parseManifestPayload(payloadJson: string): ManifestPayload {
  const parsed = parseBaseJsonObjectOrThrow(payloadJson);
  if (!isManifestPayload(parsed)) {
    throw new Error(validateManifestPayload(parsed) ?? 'Invalid manifest.');
  }
  return parsed;
}

/** Returns an error message when unsupported; `null` when the payload is acceptable. */
export function validateManifestPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload must be a JSON object.';
  }

  const manifest = payload as ManifestPayload;
  if (
    manifest.version !== MANIFEST_VERSION ||
    manifest.wrap !== MANIFEST_WRAP
  ) {
    return `Only supported version is ${MANIFEST_VERSION}, wrap: ${MANIFEST_WRAP}.`;
  }

  if (!manifest.senderPublicJwk) {
    return 'Missing senderPublicJwk in payload (invalid manifest).';
  }

  if (
    !manifest.encryptedContent?.iv ||
    !manifest.encryptedContent?.ciphertext
  ) {
    return 'Missing encryptedContent iv or ciphertext in payload (invalid manifest).';
  }

  return null;
}

export function isManifestPayload(
  payload: unknown,
): payload is ManifestPayload {
  return validateManifestPayload(payload) === null;
}

/** Stored manifest core: signable body + signature, without inline keyManifest shards. */
export function isManifestCorePayload(
  payload: unknown,
): payload is ManifestCorePayload {
  if (validateManifestPayload(payload) !== null) {
    return false;
  }

  return (
    typeof payload === 'object' &&
    payload !== null &&
    !('keyManifest' in payload)
  );
}

/** Full manifest signable body (everything except the top-level `senderSignature`). */
export function getManifestSignableBody(
  payload: ManifestPayload,
): ManifestSignableBody {
  return {
    version: payload.version,
    wrap: payload.wrap,
    senderPublicJwk: payload.senderPublicJwk,
    ephemeralPublicKey: payload.ephemeralPublicKey,
    encryptedContent: payload.encryptedContent,
    keyManifest: payload.keyManifest,
  };
}

export async function importSenderEphemeralPublicKey(
  senderAgreementEphemeralPublicJwk: JsonWebKey,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    senderAgreementEphemeralPublicJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
}

export function getKeyManifestEntryForRecipient(
  payload: ManifestPayload,
  recipientKeyId: string,
): KeyManifestRecipientPayload {
  const entry = payload.keyManifest[recipientKeyId];
  if (!entry) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }
  return entry;
}

/** AES-GCM: decrypt encrypted DEK bytes with the per-recipient KEK. */
export async function aesGcmDecryptEncryptedDek(
  kek: CryptoKey,
  iv: Uint8Array,
  encryptedDek: Uint8Array,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.slice().buffer },
    kek,
    encryptedDek.slice().buffer,
  );
}

export async function importManifestDek(
  rawDek: ArrayBuffer,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawDek,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

export type ManifestEncryptedContentWire = {
  contentIv: Uint8Array;
  ciphertext: Uint8Array;
};

export function parseEncryptedContentWire(
  encryptedContent: ManifestEncryptedContentSignableBody,
): ManifestEncryptedContentWire {
  return {
    contentIv: base64ToBytes(encryptedContent.iv),
    ciphertext: base64ToBytes(encryptedContent.ciphertext),
  };
}

export function parseEncryptedContentFromPayload(
  payload: ManifestPayload,
): ManifestEncryptedContentWire {
  return parseEncryptedContentWire(payload.encryptedContent);
}

/** Decrypt UTF-8 message body with the recovered DEK. */
export async function aesGcmDecryptManifestBody(
  dek: CryptoKey,
  { contentIv, ciphertext }: ManifestEncryptedContentWire,
): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: contentIv.slice().buffer },
    dek,
    ciphertext.slice().buffer,
  );
  return new TextDecoder().decode(plain);
}

/**
 * Recipient private × sender ephemeral public → HKDF (manifest salt) → AES-GCM decrypt of encrypted DEK.
 */
export async function decryptDekFromManifestEntry(
  entry: KeyManifestRecipientPayload,
  recipientPrivateKey: CryptoKey,
  senderAgreementEphemeralPublicJwk: JsonWebKey,
  extractableKek: boolean = false,
): Promise<{
  rawDek: ArrayBuffer;
  sharedSecret: ArrayBuffer;
  hkdfKeyMaterial: CryptoKey;
  kek: CryptoKey;
  hkdfSalt: Uint8Array;
}> {
  const senderEphemeralPublic = await importSenderEphemeralPublicKey(
    senderAgreementEphemeralPublicJwk,
  );

  const sharedSecret = await deriveEcdhSharedSecretBits(
    senderEphemeralPublic,
    recipientPrivateKey,
  );

  const hkdfKeyMaterial =
    await importSharedSecretAsHkdfKeyMaterial(sharedSecret);
  const hkdfSalt = new Uint8Array(base64ToBytes(entry.salt));
  const { kek } = await deriveAesGcmKekFromHkdfMaterial(hkdfKeyMaterial, {
    salt: hkdfSalt,
    extractable: extractableKek,
    keyUsages: ['decrypt'],
  });

  const iv = base64ToBytes(entry.iv);
  const encryptedDek = base64ToBytes(entry.encryptedDek);
  const rawDek = await aesGcmDecryptEncryptedDek(kek, iv, encryptedDek);

  return {
    rawDek,
    sharedSecret,
    hkdfKeyMaterial,
    kek,
    hkdfSalt,
  };
}

export async function decryptStoredMessageDek(
  messageId: string,
  messageCorePayload: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<ArrayBuffer> {
  const entry = await getMessageKeyManifestEntry(messageId, recipientKeyId);
  if (!entry) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }

  const core = parseManifestCorePayload(messageCorePayload);
  if (!core.ephemeralPublicKey) {
    throw new Error(
      'Missing ephemeralPublicKey in parent message (invalid manifest).',
    );
  }

  const { rawDek } = await decryptDekFromManifestEntry(
    entry,
    recipientPrivateKey,
    core.ephemeralPublicKey,
  );

  return rawDek;
}

export async function assembleStoredMessagePayload(
  messageId: string,
  corePayloadJson: string,
  recipientKeyId: string,
): Promise<string> {
  const entry = await getMessageKeyManifestEntry(messageId, recipientKeyId);
  if (!entry) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }
  return assembleManifestForRecipient(corePayloadJson, recipientKeyId, entry);
}

export async function getSenderKeyIdFromCorePayload(
  payload: string,
): Promise<string | null> {
  try {
    const parsed = parseManifestCorePayload(payload);
    return ecPublicJwkThumbprintSha256(parsed.senderPublicJwk);
  } catch {
    return null;
  }
}

export async function decryptWithManifest(
  payloadJson: string,
  recipientPrivateKey: CryptoKey,
  recipientKeyId: string,
): Promise<string> {
  const payload = parseManifestPayload(payloadJson);

  if (!payload.ephemeralPublicKey) {
    throw new Error(
      'Missing ephemeralPublicKey in payload (invalid manifest).',
    );
  }

  await verifyManifestSignature(payload);

  const entry = getKeyManifestEntryForRecipient(payload, recipientKeyId);
  const encryptedContent = parseEncryptedContentFromPayload(payload);

  try {
    const { rawDek } = await decryptDekFromManifestEntry(
      entry,
      recipientPrivateKey,
      payload.ephemeralPublicKey,
    );

    const dek = await importManifestDek(rawDek);
    return aesGcmDecryptManifestBody(dek, encryptedContent);
  } catch (e) {
    logError('decryptWithManifest', e, {
      recipientKeyId,
      manifestVersion: payload.version,
      manifestWrap: payload.wrap,
      keyManifestEntryKeyId: entry.keyId,
      hasEncryptedDek: Boolean(entry.encryptedDek),
      keyManifestEntryKeys: Object.keys(entry),
      hasSalt: Boolean(entry.salt),
      hasIv: Boolean(entry.iv),
    });
    const message =
      e instanceof Error
        ? e.message
        : 'No matching manifest entry or wrong private key.';
    throw new Error(`Failed to decrypt: ${message}`, { cause: e });
  }
}
