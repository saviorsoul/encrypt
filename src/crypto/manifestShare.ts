import type { KeyManifestMap, ManifestPayload } from '@/types/manifest.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import type {
  ManifestShareSignableBody,
  ManifestShareWirePayload,
} from '@/types/manifestShare.ts';
import {
  MANIFEST_SHARE_VERSION,
  MANIFEST_SHARE_WRAP,
} from '@/constants/manifestShare.ts';
import {
  derivePerRecipientKek,
  encryptManifestWithPerRecipientKek,
  exportCryptoKeyAsJwk,
  generateManifestEphemeralAgreementKeyPair,
  recipientsIncludingSender,
  type ManifestRecipientKeys,
} from '@/crypto/manifestEncrypt.ts';
import {
  aesGcmDecryptManifestBody,
  assembleStoredMessagePayload,
  decryptDekFromManifestEntry,
  decryptStoredMessageDek,
  decryptWithManifest,
  getSenderKeyIdFromCorePayload,
  importManifestDek,
  parseEncryptedContentFromPayload,
} from '@/crypto/manifestDecrypt.ts';
import {
  signCanonicalBody,
  verifyCanonicalSignature,
  verifyManifestSignature,
} from '@/crypto/manifestSign.ts';
import { parseManifestCorePayload } from '@/crypto/manifestStorage.ts';
import {
  getMessageKeyManifestEntry,
  hasMessageKeyManifestShard,
} from '@/services/db/storedMessageKeyManifest.ts';
import type { StoredMessage } from '@/services/db/storedMessages.ts';
import type { StoredShare } from '@/services/db/storedShares.ts';
import { getStoredMessageById } from '@/services/db/storedMessages.ts';
import { listShareDeliveriesForParentMessage } from '@/services/db/storedShares.ts';
import { parseBaseJsonObjectOrThrow } from '@/utils/validateBaseJsonText.ts';

export function isShareDelivery(
  delivery: StoredMessage | StoredShare,
): delivery is StoredShare {
  return 'parentMessageId' in delivery;
}

export function getCommentThreadMessageId(
  delivery: StoredMessage | StoredShare,
): string {
  return isShareDelivery(delivery) ? delivery.parentMessageId : delivery.id;
}

export function parseManifestShareCorePayload(
  payloadJson: string,
): ManifestShareWirePayload {
  const payload = parseBaseJsonObjectOrThrow(
    payloadJson,
  ) as unknown as ManifestShareWirePayload;
  const validationError = validateManifestShareWirePayload(payload);
  if (validationError) {
    throw new Error(validationError);
  }
  return payload;
}

export function validateManifestShareWirePayload(
  payload: ManifestShareWirePayload,
): string | null {
  if (
    payload.version !== MANIFEST_SHARE_VERSION ||
    payload.wrap !== MANIFEST_SHARE_WRAP
  ) {
    return `Only supported version is ${MANIFEST_SHARE_VERSION}, wrap: ${MANIFEST_SHARE_WRAP}.`;
  }

  if (!payload.sharerPublicJwk) {
    return 'Missing sharerPublicJwk in share payload.';
  }

  if (!payload.ephemeralPublicKey) {
    return 'Missing ephemeralPublicKey in share payload.';
  }

  if (!payload.sharerSignature) {
    return 'Missing sharerSignature in share payload.';
  }

  if (!payload.parentMessageId) {
    return 'Missing parentMessageId in share payload.';
  }

  return null;
}

export function manifestShareSignableBodyForSigning(
  body: ManifestShareSignableBody,
): Record<string, unknown> {
  return {
    version: body.version,
    wrap: body.wrap,
    parentMessageId: body.parentMessageId,
    sharerPublicJwk: body.sharerPublicJwk,
    ephemeralPublicKey: body.ephemeralPublicKey,
  };
}

export async function signManifestShareBody(
  sharerSigningPrivateKey: CryptoKey,
  body: ManifestShareSignableBody,
): Promise<string> {
  return signCanonicalBody(
    sharerSigningPrivateKey,
    manifestShareSignableBodyForSigning(body),
  );
}

export async function verifyManifestShareSignature(
  payload: ManifestShareWirePayload,
): Promise<void> {
  const { sharerSignature, ...signableBody } = payload;
  await verifyCanonicalSignature(
    payload.sharerPublicJwk,
    sharerSignature,
    manifestShareSignableBodyForSigning(signableBody),
    'Share signature verification failed (payload may have been tampered with).',
  );
}

export async function getSharerKeyIdFromSharePayload(
  payload: string,
): Promise<string | null> {
  try {
    const parsed = parseManifestShareCorePayload(payload);
    return ecPublicJwkThumbprintSha256(parsed.sharerPublicJwk);
  } catch {
    return null;
  }
}

/**
 * Recover the parent message DEK from whichever delivery row holds the recipient shard
 * (original post id or a prior share delivery id).
 */
export async function decryptParentMessageDekFromDelivery(
  parentMessageId: string,
  parentCorePayloadJson: string,
  deliveryMessageId: string,
  deliveryCorePayloadJson: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<ArrayBuffer> {
  if (deliveryMessageId === parentMessageId) {
    return decryptStoredMessageDek(
      parentMessageId,
      parentCorePayloadJson,
      recipientKeyId,
      recipientPrivateKey,
    );
  }

  const shareCore = parseManifestShareCorePayload(deliveryCorePayloadJson);
  if (shareCore.parentMessageId !== parentMessageId) {
    throw new Error('Share delivery does not match the parent message.');
  }

  const entry = await getMessageKeyManifestEntry(
    deliveryMessageId,
    recipientKeyId,
  );
  if (!entry) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }

  const { rawDek } = await decryptDekFromManifestEntry(
    entry,
    recipientPrivateKey,
    shareCore.ephemeralPublicKey,
  );
  return rawDek;
}

export type BuildManifestShareResult = {
  shareCoreJson: string;
  keyManifest: KeyManifestMap;
};

/**
 * Re-wrap the parent message DEK for new recipients under a fresh ephemeral key pair.
 * Does not mutate the parent message or existing recipient shards.
 * The sharer's shard may be on the parent row or any prior share delivery for that parent.
 */
export async function buildManifestShare(
  parentMessageId: string,
  sharerKeyId: string,
  sharerPrivateKey: CryptoKey,
  sharerPublicKey: CryptoKey,
  sharerSigningPrivateKey: CryptoKey,
  newRecipients: ManifestRecipientKeys[],
): Promise<BuildManifestShareResult> {
  if (newRecipients.length === 0) {
    throw new Error('Select at least one recipient to share with.');
  }

  const access = await resolveParentMessageAccess(parentMessageId, sharerKeyId);
  if (!access) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }

  const parentCore = parseManifestCorePayload(access.parentCorePayloadJson);
  await verifyManifestSignature(parentCore);

  const rawDek = await decryptParentMessageDekFromDelivery(
    access.parentMessageId,
    access.parentCorePayloadJson,
    access.deliveryMessageId,
    access.deliveryCorePayloadJson,
    sharerKeyId,
    sharerPrivateKey,
  );

  const allRecipients = await recipientsIncludingSender(
    newRecipients,
    sharerPublicKey,
  );

  const ephemeralKeyPair = await generateManifestEphemeralAgreementKeyPair();
  const recipientsWithKek = await derivePerRecipientKek(
    allRecipients,
    ephemeralKeyPair.privateKey,
  );
  const keyManifest = await encryptManifestWithPerRecipientKek(
    recipientsWithKek,
    { rawDek },
  );

  const sharerPublicJwk = await exportCryptoKeyAsJwk(sharerPublicKey);
  const ephemeralPublicKey = await exportCryptoKeyAsJwk(
    ephemeralKeyPair.publicKey,
  );

  const signableBody: ManifestShareSignableBody = {
    version: MANIFEST_SHARE_VERSION,
    wrap: MANIFEST_SHARE_WRAP,
    parentMessageId,
    sharerPublicJwk,
    ephemeralPublicKey,
  };

  const sharerSignature = await signManifestShareBody(
    sharerSigningPrivateKey,
    signableBody,
  );

  const shareCoreJson = JSON.stringify({
    sharerSignature,
    ...signableBody,
  });

  return { shareCoreJson, keyManifest };
}

export async function decryptShareImportPayload(
  shareCorePayloadJson: string,
  parentCorePayloadJson: string,
  keyManifest: KeyManifestMap,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<string> {
  const shareCore = parseManifestShareCorePayload(shareCorePayloadJson);
  await verifyManifestShareSignature(shareCore);

  const parentCore = parseManifestCorePayload(parentCorePayloadJson);

  await verifyManifestSignature(parentCore);

  const entry = keyManifest[recipientKeyId];
  if (!entry) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }

  const { rawDek } = await decryptDekFromManifestEntry(
    entry,
    recipientPrivateKey,
    shareCore.ephemeralPublicKey,
  );
  const dek = await importManifestDek(rawDek);
  const encryptedContent = parseEncryptedContentFromPayload(
    parentCore as ManifestPayload,
  );
  return aesGcmDecryptManifestBody(dek, encryptedContent);
}

export async function decryptSharedStoredMessage(
  shareId: string,
  parentMessageId: string,
  shareCorePayloadJson: string,
  parentCorePayloadJson: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<string> {
  const shareCore = parseManifestShareCorePayload(shareCorePayloadJson);
  await verifyManifestShareSignature(shareCore);

  const parentCore = parseManifestCorePayload(parentCorePayloadJson);
  await verifyManifestSignature(parentCore);
  if (shareCore.parentMessageId !== parentMessageId) {
    throw new Error('Share delivery does not match the parent message.');
  }

  const rawDek = await decryptParentMessageDekFromDelivery(
    parentMessageId,
    parentCorePayloadJson,
    shareId,
    shareCorePayloadJson,
    recipientKeyId,
    recipientPrivateKey,
  );
  const dek = await importManifestDek(rawDek);
  const encryptedContent = parseEncryptedContentFromPayload(
    parentCore as ManifestPayload,
  );
  return aesGcmDecryptManifestBody(dek, encryptedContent);
}

export async function decryptStoredDeliveryWithPrivateKey(
  delivery: StoredMessage | StoredShare,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<string> {
  if (!isShareDelivery(delivery)) {
    const access = await resolveParentMessageAccess(delivery.id, recipientKeyId);
    if (!access) {
      throw new Error(
        'No key manifest entry for the given recipientKeyId (wrong key pair?).',
      );
    }

    if (access.deliveryMessageId === delivery.id) {
      const assembledPayload = await assembleStoredMessagePayload(
        delivery.id,
        delivery.payload,
        recipientKeyId,
      );
      return decryptWithManifest(
        assembledPayload,
        recipientPrivateKey,
        recipientKeyId,
      );
    }

    return decryptSharedStoredMessage(
      access.deliveryMessageId,
      access.parentMessageId,
      access.deliveryCorePayloadJson,
      access.parentCorePayloadJson,
      recipientKeyId,
      recipientPrivateKey,
    );
  }

  const parent = await getStoredMessageById(delivery.parentMessageId);
  if (!parent) {
    throw new Error(`Parent message not found: ${delivery.parentMessageId}`);
  }

  return decryptSharedStoredMessage(
    delivery.id,
    delivery.parentMessageId,
    delivery.payload,
    parent.payload,
    recipientKeyId,
    recipientPrivateKey,
  );
}

export type ParentMessageAccess = {
  parentMessageId: string;
  parentCorePayloadJson: string;
  deliveryMessageId: string;
  deliveryCorePayloadJson: string;
};

/** Find how a recipient can unwrap the parent post DEK (direct shard or via a share delivery). */
export async function resolveParentMessageAccess(
  parentMessageId: string,
  recipientKeyId: string,
): Promise<ParentMessageAccess | null> {
  const parent = await getStoredMessageById(parentMessageId);
  if (!parent) {
    return null;
  }

  if (await hasMessageKeyManifestShard(parentMessageId, recipientKeyId)) {
    return {
      parentMessageId,
      parentCorePayloadJson: parent.payload,
      deliveryMessageId: parentMessageId,
      deliveryCorePayloadJson: parent.payload,
    };
  }

  const shareDeliveries =
    await listShareDeliveriesForParentMessage(parentMessageId);
  for (const share of shareDeliveries) {
    if (await hasMessageKeyManifestShard(share.id, recipientKeyId)) {
      return {
        parentMessageId,
        parentCorePayloadJson: parent.payload,
        deliveryMessageId: share.id,
        deliveryCorePayloadJson: share.payload,
      };
    }
  }

  return null;
}

/** Sharer key id when access is via a share delivery; null for direct parent access. */
export async function getSharerKeyIdForRecipientParentAccess(
  parentMessageId: string,
  recipientKeyId: string,
): Promise<string | null> {
  const access = await resolveParentMessageAccess(
    parentMessageId,
    recipientKeyId,
  );
  if (!access || access.deliveryMessageId === parentMessageId) {
    return null;
  }

  return getSharerKeyIdFromSharePayload(access.deliveryCorePayloadJson);
}

export async function recipientHasAccessToParentMessage(
  parentMessageId: string,
  recipientKeyId: string,
): Promise<boolean> {
  return (
    (await resolveParentMessageAccess(parentMessageId, recipientKeyId)) !== null
  );
}

/** Original sender or a recipient of the post / any share delivery may comment. */
export async function canCommentOnParentMessage(
  parentMessageId: string,
  recipientKeyId: string,
): Promise<boolean> {
  const parent = await getStoredMessageById(parentMessageId);
  if (!parent) {
    return false;
  }

  const senderKeyId = await getSenderKeyIdFromCorePayload(parent.payload);
  if (senderKeyId === recipientKeyId) {
    return true;
  }

  return recipientHasAccessToParentMessage(parentMessageId, recipientKeyId);
}

export async function decryptParentMessageDekForRecipient(
  parentMessageId: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
): Promise<ArrayBuffer> {
  const access = await resolveParentMessageAccess(
    parentMessageId,
    recipientKeyId,
  );
  if (!access) {
    throw new Error(
      'No key manifest entry for the given recipientKeyId (wrong key pair?).',
    );
  }

  return decryptParentMessageDekFromDelivery(
    access.parentMessageId,
    access.parentCorePayloadJson,
    access.deliveryMessageId,
    access.deliveryCorePayloadJson,
    recipientKeyId,
    recipientPrivateKey,
  );
}
