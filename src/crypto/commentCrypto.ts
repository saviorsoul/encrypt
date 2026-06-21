import type { CommentPayload, CommentSignableBody } from '@/types/comment.ts';
import { base64ToBytes, bytesToBase64 } from '@/utils/bytes.ts';
import {
  COMMENT_HKDF_INFO,
  COMMENT_VERSION,
  COMMENT_WRAP,
} from '@/crypto/commentConstants.ts';
import { HKDF_SALT_LENGTH } from '@/crypto/manifestConstants.ts';
import {
  aesGcmDecryptManifestBody,
  parseEncryptedContentWire,
} from '@/crypto/manifestDecrypt.ts';
import { decryptParentMessageDekForRecipient } from '@/crypto/manifestShare.ts';
import {
  aesGcmEncryptManifestBody,
  deriveAesGcmKeyFromHkdfMaterial,
  exportCryptoKeyAsJwk,
  encryptedContentToSignableBody,
  importSharedSecretAsHkdfKeyMaterial,
  type ManifestEncryptedContent,
} from '@/crypto/manifestEncrypt.ts';
import {
  signCanonicalBody,
  verifyCanonicalSignature,
} from '@/crypto/manifestSign.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import { parseBaseJsonObjectOrThrow } from '@/utils/validateBaseJsonText.ts';

export function parseCommentPayload(payloadJson: string): CommentPayload {
  return parseBaseJsonObjectOrThrow(payloadJson) as unknown as CommentPayload;
}

function parseCommentHkdfSalt(saltBase64: string): Uint8Array<ArrayBuffer> {
  const salt = new Uint8Array(base64ToBytes(saltBase64));
  if (salt.length !== HKDF_SALT_LENGTH) {
    throw new Error(
      `Comment HKDF salt must be ${HKDF_SALT_LENGTH} bytes after base64 decode.`,
    );
  }
  return salt;
}

export function generateCommentHkdfSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(HKDF_SALT_LENGTH));
}

export async function importCommentHkdfKeyMaterialFromDek(
  rawDek: ArrayBuffer,
): Promise<{
  hkdfKeyMaterial: CryptoKey;
  dekBase64: string;
  hkdfMaterialFingerprintBase64: string;
}> {
  const hkdfKeyMaterial = await importSharedSecretAsHkdfKeyMaterial(rawDek);
  const digest = await crypto.subtle.digest('SHA-256', rawDek);
  return {
    hkdfKeyMaterial,
    dekBase64: bytesToBase64(new Uint8Array(rawDek)),
    hkdfMaterialFingerprintBase64: bytesToBase64(new Uint8Array(digest)),
  };
}

export async function deriveCommentKeyFromDek(
  rawDek: ArrayBuffer,
  hkdfSalt: Uint8Array<ArrayBuffer>,
  options: { extractable?: boolean } = {},
): Promise<CryptoKey> {
  const hkdfKeyMaterial = await importSharedSecretAsHkdfKeyMaterial(rawDek);
  return deriveCommentKeyFromHkdfMaterial(hkdfKeyMaterial, hkdfSalt, options);
}

export async function deriveCommentKeyFromHkdfMaterial(
  hkdfKeyMaterial: CryptoKey,
  hkdfSalt: Uint8Array<ArrayBuffer>,
  options: { extractable?: boolean } = {},
): Promise<CryptoKey> {
  return deriveAesGcmKeyFromHkdfMaterial(hkdfKeyMaterial, hkdfSalt, {
    info: COMMENT_HKDF_INFO,
    keyUsages: ['encrypt', 'decrypt'],
    extractable: options.extractable,
  });
}

export async function encryptCommentBody(
  commentKey: CryptoKey,
  commentText: string,
): Promise<ManifestEncryptedContent> {
  return aesGcmEncryptManifestBody(commentKey, commentText);
}

export async function buildCommentSignableBody({
  messageId,
  senderPublicKey,
  hkdfSalt,
  encryptedContent,
}: {
  messageId: string;
  senderPublicKey: CryptoKey;
  hkdfSalt: Uint8Array<ArrayBuffer>;
  encryptedContent: ManifestEncryptedContent;
}): Promise<CommentSignableBody> {
  return {
    version: COMMENT_VERSION,
    wrap: COMMENT_WRAP,
    parentMessageId: messageId,
    senderPublicJwk: await exportCryptoKeyAsJwk(senderPublicKey),
    salt: bytesToBase64(hkdfSalt),
    encryptedContent: encryptedContentToSignableBody(encryptedContent),
  };
}

export async function signCommentPayload(
  signableBody: CommentSignableBody,
  senderSigningPrivateKey: CryptoKey,
): Promise<string> {
  const senderSignature = await signCanonicalBody(
    senderSigningPrivateKey,
    signableBody,
  );
  return JSON.stringify({ senderSignature, ...signableBody }, null, 2);
}

/**
 * Encrypt a comment under the parent message DEK (HKDF-derived).
 * Only the author's own key-manifest shard and private key are required.
 */
export async function encryptCommentWithMessageKey(
  commentText: string,
  messageId: string,
  messageCorePayload: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey,
  senderSigningPrivateKey: CryptoKey,
): Promise<string> {
  const rawDek = await decryptParentMessageDekForRecipient(
    messageId,
    recipientKeyId,
    recipientPrivateKey,
  );
  const hkdfSalt = generateCommentHkdfSalt();
  const commentKey = await deriveCommentKeyFromDek(rawDek, hkdfSalt);
  const encryptedContent = await encryptCommentBody(commentKey, commentText);
  const signableBody = await buildCommentSignableBody({
    messageId,
    senderPublicKey,
    hkdfSalt,
    encryptedContent,
  });
  return signCommentPayload(signableBody, senderSigningPrivateKey);
}

/**
 * Decrypt a comment using the parent message DEK.
 */
export async function decryptComment(
  payloadJson: string,
  messageId: string,
  messageCorePayload: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<string> {
  const payload = parseCommentPayload(payloadJson);

  if (payload.parentMessageId !== messageId) {
    throw new Error(
      'Comment parentMessageId does not match the parent message.',
    );
  }

  const { senderSignature, ...signableBody } = payload;
  await verifyCanonicalSignature(
    payload.senderPublicJwk,
    senderSignature,
    signableBody,
    'Comment signature verification failed (payload may have been tampered with).',
  );

  const rawDek = await decryptParentMessageDekForRecipient(
    messageId,
    recipientKeyId,
    recipientPrivateKey,
  );
  const commentKey = await deriveCommentKeyFromDek(
    rawDek,
    parseCommentHkdfSalt(signableBody.salt),
  );

  return aesGcmDecryptManifestBody(
    commentKey,
    parseEncryptedContentWire(payload.encryptedContent),
  );
}

export async function getCommentAuthorKeyIdFromPayload(
  payload: string,
): Promise<string | null> {
  try {
    const parsed = parseCommentPayload(payload);
    return ecPublicJwkThumbprintSha256(parsed.senderPublicJwk);
  } catch {
    return null;
  }
}
