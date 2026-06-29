import type { KeyManifestMap, ManifestPayload } from '../types/manifest.ts';
import { ecPublicJwkThumbprintSha256 } from './jwkThumbprint.ts';
import type {
  ManifestShareSignableBody,
  ManifestShareWirePayload,
} from '../types/manifestShare.ts';
import {
  MANIFEST_SHARE_VERSION,
  MANIFEST_SHARE_WRAP,
} from '../constants/manifestShare.ts';
import {
  derivePerRecipientKek,
  encryptManifestWithPerRecipientKek,
  exportCryptoKeyAsJwk,
  generateManifestEphemeralAgreementKeyPair,
  recipientsIncludingSender,
  type ManifestRecipientKeys,
} from './manifestEncrypt.ts';
import {
  aesGcmDecryptManifestBody,
  decryptDekFromManifestEntry,
  importManifestDek,
  parseEncryptedContentFromPayload,
} from './manifestDecrypt.ts';
import {
  signCanonicalBody,
  verifyCanonicalSignature,
  verifyManifestSignature,
} from './manifestSign.ts';
import { parseManifestCorePayload } from './manifestStorage.ts';
import { parseBaseJsonObjectOrThrow } from '../utils/validateBaseJsonText.ts';
import type { ParentMessageAccess, KeyManifestLookup } from '../feed/access.ts';
import { getManifestEntryOrThrow } from '../feed/access.ts';
import type { StoredFeedDelivery, StoredMessage } from '../feed/types.ts';

export type { ParentMessageAccess, KeyManifestLookup } from '../feed/access.ts';

export function isShareDelivery(
  delivery: StoredFeedDelivery,
): delivery is StoredFeedDelivery & { messageId: string } {
  return 'messageId' in delivery;
}

export function getCommentThreadMessageId(
  delivery: StoredFeedDelivery,
): string {
  return isShareDelivery(delivery) ? delivery.messageId : delivery.id;
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

export async function decryptParentMessageDekFromDelivery(
  parentMessageId: string,
  parentCorePayloadJson: string,
  deliveryMessageId: string,
  deliveryCorePayloadJson: string,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
  getManifestEntry: KeyManifestLookup,
): Promise<ArrayBuffer> {
  if (deliveryMessageId === parentMessageId) {
    const entry = await getManifestEntryOrThrow(
      getManifestEntry,
      parentMessageId,
      recipientKeyId,
    );
    const core = parseManifestCorePayload(parentCorePayloadJson);
    const { rawDek } = await decryptDekFromManifestEntry(
      entry,
      recipientPrivateKey,
      core.ephemeralPublicKey,
    );
    return rawDek;
  }

  const shareCore = parseManifestShareCorePayload(deliveryCorePayloadJson);
  if (shareCore.parentMessageId !== parentMessageId) {
    throw new Error('Share delivery does not match the parent message.');
  }

  const entry = await getManifestEntryOrThrow(
    getManifestEntry,
    deliveryMessageId,
    recipientKeyId,
  );

  const { rawDek } = await decryptDekFromManifestEntry(
    entry,
    recipientPrivateKey,
    shareCore.ephemeralPublicKey,
  );
  return rawDek;
}

export async function decryptParentMessageDekFromAccess(
  access: ParentMessageAccess,
  recipientKeyId: string,
  recipientPrivateKey: CryptoKey,
  getManifestEntry: KeyManifestLookup,
): Promise<ArrayBuffer> {
  return decryptParentMessageDekFromDelivery(
    access.parentMessageId,
    access.parentCorePayloadJson,
    access.deliveryMessageId,
    access.deliveryCorePayloadJson,
    recipientKeyId,
    recipientPrivateKey,
    getManifestEntry,
  );
}

export type BuildManifestShareResult = {
  shareCoreJson: string;
  keyManifest: KeyManifestMap;
};

export async function buildManifestShareWithAccess(
  access: ParentMessageAccess,
  sharerKeyId: string,
  sharerPrivateKey: CryptoKey,
  sharerPublicKey: CryptoKey,
  sharerSigningPrivateKey: CryptoKey,
  newRecipients: ManifestRecipientKeys[],
  getManifestEntry: KeyManifestLookup,
): Promise<BuildManifestShareResult> {
  if (newRecipients.length === 0) {
    throw new Error('Select at least one recipient to share with.');
  }

  const parentCore = parseManifestCorePayload(access.parentCorePayloadJson);
  await verifyManifestSignature(parentCore);

  const rawDek = await decryptParentMessageDekFromAccess(
    access,
    sharerKeyId,
    sharerPrivateKey,
    getManifestEntry,
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
    parentMessageId: access.parentMessageId,
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
  getManifestEntry: KeyManifestLookup,
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
    getManifestEntry,
  );
  const dek = await importManifestDek(rawDek);
  const encryptedContent = parseEncryptedContentFromPayload(
    parentCore as ManifestPayload,
  );
  return aesGcmDecryptManifestBody(dek, encryptedContent);
}

export function pickCanonicalFeedMessage(
  threadMessages: StoredFeedDelivery[],
): StoredMessage | null {
  return threadMessages.find((message) => !isShareDelivery(message)) ?? null;
}
