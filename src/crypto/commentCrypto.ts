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

async function deriveCommentKeyFromDek(
  rawDek: ArrayBuffer,
  hkdfSalt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const hkdfKeyMaterial = await importSharedSecretAsHkdfKeyMaterial(rawDek);
  return deriveAesGcmKeyFromHkdfMaterial(hkdfKeyMaterial, hkdfSalt, {
    info: COMMENT_HKDF_INFO,
    keyUsages: ['encrypt', 'decrypt'],
  });
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
  const hkdfSalt = crypto.getRandomValues(new Uint8Array(HKDF_SALT_LENGTH));
  const commentKey = await deriveCommentKeyFromDek(rawDek, hkdfSalt);
  const encryptedContent = await aesGcmEncryptManifestBody(
    commentKey,
    commentText,
  );

  const signableBody: CommentSignableBody = {
    version: COMMENT_VERSION,
    wrap: COMMENT_WRAP,
    parentMessageId: messageId,
    senderPublicJwk: await exportCryptoKeyAsJwk(senderPublicKey),
    salt: bytesToBase64(hkdfSalt),
    encryptedContent: encryptedContentToSignableBody(encryptedContent),
  };

  const senderSignature = await signCanonicalBody(
    senderSigningPrivateKey,
    signableBody,
  );

  return JSON.stringify({ senderSignature, ...signableBody }, null, 2);
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
