import {
  buildCommentSignableBody,
  deriveCommentKeyFromDek,
  encryptCommentBody,
  generateCommentHkdfSalt,
  verifyCommentSignature,
} from '../crypto/commentCrypto.ts';
import {
  isShareDelivery,
  manifestShareSignableBodyForSigning,
  parseManifestShareCorePayload,
} from '../crypto/manifestShare.ts';
import { resolveParentMessageAccessFromFeed } from './access.ts';
import { getManifestEntryOrThrow } from './access.ts';
import type { KeyManifestLookup, ParentMessageAccess } from './access.ts';
import type { KeyManifestRecipientPayload } from '../types/manifest.ts';
import type { ManifestRecipientKeys } from '../types/manifest.ts';
import type { CommentPayload } from '../types/comment.ts';
import {
  assembleStoredMessagePayloadFromEntry,
  aesGcmDecryptManifestBody,
  importManifestDek,
  parseEncryptedContentFromPayload,
  parseEncryptedContentWire,
  unwrapRawDekFromManifestEntryWithSharedSecret,
} from '../crypto/manifestDecrypt.ts';
import {
  aesGcmEncryptManifestBody,
  buildManifestAssembly,
  derivePerRecipientKek,
  encryptManifestWithPerRecipientKek,
  exportCryptoKeyAsJwk,
  generateManifestDek,
  generateManifestEphemeralAgreementKeyPair,
  recipientsIncludingSender,
} from '../crypto/manifestEncrypt.ts';
import { importPublicKeyExtractable } from '../crypto/ecdhKeys.ts';
import {
  manifestSignableBodyForSigning,
  verifyManifestSignature,
} from '../crypto/manifestSign.ts';
import { parseManifestCorePayload } from '../crypto/manifestStorage.ts';
import {
  MANIFEST_SHARE_VERSION,
  MANIFEST_SHARE_WRAP,
} from '../constants/manifestShare.ts';
import type { ManifestPayload } from '../types/manifest.ts';
import type { StoredComment, StoredFeedDelivery } from './types.ts';
import { base64ToBytes } from '../utils/bytes.ts';
import { parseBaseJsonObjectOrThrow } from '../utils/validateBaseJsonText.ts';
import { verifyManifestShareSignature } from '../crypto/manifestShare.ts';

export type FeedLabBridgeManifestLookupWire = Record<
  string,
  Record<string, KeyManifestRecipientPayload>
>;

export type FeedLabBridgeRecipientWire = {
  keyId: string;
  publicJwk: JsonWebKey;
};

export type BridgeOracleCallbacks = {
  agreeSharedSecret: (peerPublicJwk: JsonWebKey) => Promise<ArrayBuffer>;
  signCanonical: (signable: Record<string, unknown>) => Promise<string>;
};

function buildManifestLookupFromWire(
  wire: FeedLabBridgeManifestLookupWire,
): KeyManifestLookup {
  return (messageId, recipientKeyId) => {
    const entry = wire[messageId]?.[recipientKeyId];
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    return entry as KeyManifestRecipientPayload;
  };
}

async function resolveManifestEntry(
  lookup: KeyManifestLookup,
  messageId: string,
  recipientKeyId: string,
): Promise<KeyManifestRecipientPayload | null> {
  const entry = await Promise.resolve(lookup(messageId, recipientKeyId));
  return entry ?? null;
}

async function wireRecipientsToKeys(
  recipients: FeedLabBridgeRecipientWire[],
): Promise<ManifestRecipientKeys[]> {
  const keys: ManifestRecipientKeys[] = [];
  for (const recipient of recipients) {
    keys.push({
      keyId: recipient.keyId,
      publicKey: await importPublicKeyExtractable(recipient.publicJwk),
    });
  }
  return keys;
}

function parseCommentHkdfSalt(saltBase64: string): Uint8Array<ArrayBuffer> {
  const salt = new Uint8Array(base64ToBytes(saltBase64));
  return salt;
}

async function decryptDekWithAgree(
  entry: KeyManifestRecipientPayload,
  senderAgreementEphemeralPublicJwk: JsonWebKey,
  agree: BridgeOracleCallbacks['agreeSharedSecret'],
): Promise<ArrayBuffer> {
  const sharedSecret = await agree(senderAgreementEphemeralPublicJwk);
  return unwrapRawDekFromManifestEntryWithSharedSecret(entry, sharedSecret);
}

async function decryptParentMessageDekFromDeliveryWithAgree(
  parentMessageId: string,
  parentCorePayloadJson: string,
  deliveryMessageId: string,
  deliveryCorePayloadJson: string,
  recipientKeyId: string,
  agree: BridgeOracleCallbacks['agreeSharedSecret'],
  getManifestEntry: KeyManifestLookup,
): Promise<ArrayBuffer> {
  if (deliveryMessageId === parentMessageId) {
    const entry = await getManifestEntryOrThrow(
      getManifestEntry,
      parentMessageId,
      recipientKeyId,
    );
    const core = parseManifestCorePayload(parentCorePayloadJson);
    return decryptDekWithAgree(entry, core.ephemeralPublicKey, agree);
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
  return decryptDekWithAgree(entry, shareCore.ephemeralPublicKey, agree);
}

async function decryptParentMessageDekFromAccessWithAgree(
  access: ParentMessageAccess,
  recipientKeyId: string,
  agree: BridgeOracleCallbacks['agreeSharedSecret'],
  getManifestEntry: KeyManifestLookup,
): Promise<ArrayBuffer> {
  return decryptParentMessageDekFromDeliveryWithAgree(
    access.parentMessageId,
    access.parentCorePayloadJson,
    access.deliveryMessageId,
    access.deliveryCorePayloadJson,
    recipientKeyId,
    agree,
    getManifestEntry,
  );
}

async function decryptWithManifestWithAgree(
  payloadJson: string,
  recipientKeyId: string,
  agree: BridgeOracleCallbacks['agreeSharedSecret'],
): Promise<string> {
  const payload = JSON.parse(payloadJson) as ManifestPayload;
  await verifyManifestSignature(payload);
  const entry = payload.keyManifest[recipientKeyId];
  if (!entry) {
    throw new Error('No matching manifest entry or wrong private key.');
  }
  const encryptedContent = parseEncryptedContentFromPayload(payload);
  const rawDek = await decryptDekWithAgree(
    entry,
    payload.ephemeralPublicKey,
    agree,
  );
  const dek = await importManifestDek(rawDek);
  return aesGcmDecryptManifestBody(dek, encryptedContent);
}

async function decryptSharedStoredMessageWithAgree(
  shareId: string,
  parentMessageId: string,
  shareCorePayloadJson: string,
  parentCorePayloadJson: string,
  recipientKeyId: string,
  agree: BridgeOracleCallbacks['agreeSharedSecret'],
  getManifestEntry: KeyManifestLookup,
): Promise<string> {
  const shareCore = parseManifestShareCorePayload(shareCorePayloadJson);
  await verifyManifestShareSignature(shareCore);

  const parentCore = parseManifestCorePayload(parentCorePayloadJson);
  await verifyManifestSignature(parentCore);
  if (shareCore.parentMessageId !== parentMessageId) {
    throw new Error('Share delivery does not match the parent message.');
  }

  const rawDek = await decryptParentMessageDekFromDeliveryWithAgree(
    parentMessageId,
    parentCorePayloadJson,
    shareId,
    shareCorePayloadJson,
    recipientKeyId,
    agree,
    getManifestEntry,
  );
  const dek = await importManifestDek(rawDek);
  const encryptedContent = parseEncryptedContentFromPayload(
    parentCore as ManifestPayload,
  );
  return aesGcmDecryptManifestBody(dek, encryptedContent);
}

async function encryptWithManifestWithSign(
  plaintext: string,
  recipients: ManifestRecipientKeys[],
  senderPublicKey: CryptoKey,
  signCanonical: BridgeOracleCallbacks['signCanonical'],
): Promise<string> {
  const allRecipients = await recipientsIncludingSender(
    recipients,
    senderPublicKey,
  );
  const ephemeralKeyPair = await generateManifestEphemeralAgreementKeyPair();
  const recipientsWithKek = await derivePerRecipientKek(
    allRecipients,
    ephemeralKeyPair.privateKey,
  );
  const dekMaterial = await generateManifestDek();
  const encryptedContent = await aesGcmEncryptManifestBody(
    dekMaterial.dek,
    plaintext,
  );
  const keyManifest = await encryptManifestWithPerRecipientKek(
    recipientsWithKek,
    dekMaterial,
  );
  const assembly = await buildManifestAssembly(
    senderPublicKey,
    ephemeralKeyPair.publicKey,
    encryptedContent,
    keyManifest,
  );
  const senderSignature = await signCanonical(
    manifestSignableBodyForSigning(assembly),
  );
  return JSON.stringify({ senderSignature, ...assembly });
}

async function buildManifestShareWithAccessAndBridge(
  access: ParentMessageAccess,
  sharerKeyId: string,
  sharerPublicKey: CryptoKey,
  newRecipients: ManifestRecipientKeys[],
  getManifestEntry: KeyManifestLookup,
  oracle: BridgeOracleCallbacks,
): Promise<{ shareCoreJson: string; keyManifest: Record<string, unknown> }> {
  const parentCore = parseManifestCorePayload(access.parentCorePayloadJson);
  await verifyManifestSignature(parentCore);

  const rawDek = await decryptParentMessageDekFromAccessWithAgree(
    access,
    sharerKeyId,
    oracle.agreeSharedSecret,
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

  const signableBody = {
    version: MANIFEST_SHARE_VERSION,
    wrap: MANIFEST_SHARE_WRAP,
    parentMessageId: access.parentMessageId,
    sharerPublicJwk,
    ephemeralPublicKey,
  };

  const sharerSignature = await oracle.signCanonical(
    manifestShareSignableBodyForSigning(signableBody),
  );

  const shareCoreJson = JSON.stringify({
    sharerSignature,
    ...signableBody,
  });

  return { shareCoreJson, keyManifest };
}

async function encryptCommentWithMessageKeyAndBridge(
  commentText: string,
  messageId: string,
  access: ParentMessageAccess,
  recipientKeyId: string,
  senderPublicKey: CryptoKey,
  getManifestEntry: KeyManifestLookup,
  oracle: BridgeOracleCallbacks,
): Promise<string> {
  const rawDek = await decryptParentMessageDekFromAccessWithAgree(
    access,
    recipientKeyId,
    oracle.agreeSharedSecret,
    getManifestEntry,
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
  const senderSignature = await oracle.signCanonical(
    signableBody as unknown as Record<string, unknown>,
  );
  return JSON.stringify({ senderSignature, ...signableBody });
}

export type FeedLabBridgeEncryptMessagePayload = {
  plaintext: string;
  recipients: FeedLabBridgeRecipientWire[];
};

export type FeedLabBridgeEncryptSharePayload = {
  access: ParentMessageAccess;
  recipients: FeedLabBridgeRecipientWire[];
  manifestEntries: FeedLabBridgeManifestLookupWire;
};

export type FeedLabBridgeEncryptCommentPayload = {
  text: string;
  messageId: string;
  access: ParentMessageAccess;
  manifestEntries: FeedLabBridgeManifestLookupWire;
};

export type FeedLabBridgeDecryptMessagePayload = {
  delivery: StoredFeedDelivery;
  allDeliveries: StoredFeedDelivery[];
  manifestEntries: FeedLabBridgeManifestLookupWire;
};

export type FeedLabBridgeDecryptCommentPayload = {
  comment: StoredComment;
  allDeliveries: StoredFeedDelivery[];
  manifestEntries: FeedLabBridgeManifestLookupWire;
};

export type FeedLabBridgeDecryptCommentsPayload = {
  comments: StoredComment[];
  allDeliveries: StoredFeedDelivery[];
  manifestEntries: FeedLabBridgeManifestLookupWire;
};

export async function bridgeEncryptMessage(
  oracle: BridgeOracleCallbacks,
  senderPublicKey: CryptoKey,
  payload: FeedLabBridgeEncryptMessagePayload,
): Promise<{ body: Record<string, unknown> }> {
  const recipients = await wireRecipientsToKeys(payload.recipients);
  const wireJson = await encryptWithManifestWithSign(
    payload.plaintext,
    recipients,
    senderPublicKey,
    oracle.signCanonical,
  );
  return { body: JSON.parse(wireJson) as Record<string, unknown> };
}

export async function bridgeEncryptShare(
  oracle: BridgeOracleCallbacks,
  sharerKeyId: string,
  sharerPublicKey: CryptoKey,
  payload: FeedLabBridgeEncryptSharePayload,
): Promise<{ shareCoreJson: string; keyManifest: Record<string, unknown> }> {
  const manifestLookup = buildManifestLookupFromWire(payload.manifestEntries);
  const recipients = await wireRecipientsToKeys(payload.recipients);
  return buildManifestShareWithAccessAndBridge(
    payload.access,
    sharerKeyId,
    sharerPublicKey,
    recipients,
    manifestLookup,
    oracle,
  );
}

export async function bridgeEncryptComment(
  oracle: BridgeOracleCallbacks,
  recipientKeyId: string,
  senderPublicKey: CryptoKey,
  payload: FeedLabBridgeEncryptCommentPayload,
): Promise<{ payload: Record<string, unknown> }> {
  const manifestLookup = buildManifestLookupFromWire(payload.manifestEntries);
  const payloadJson = await encryptCommentWithMessageKeyAndBridge(
    payload.text,
    payload.messageId,
    payload.access,
    recipientKeyId,
    senderPublicKey,
    manifestLookup,
    oracle,
  );
  return { payload: JSON.parse(payloadJson) as Record<string, unknown> };
}

export async function bridgeDecryptMessage(
  oracle: BridgeOracleCallbacks,
  recipientKeyId: string,
  payload: FeedLabBridgeDecryptMessagePayload,
): Promise<{ plaintext: string }> {
  const manifestLookup = buildManifestLookupFromWire(payload.manifestEntries);
  const delivery = payload.delivery;
  const allDeliveries = payload.allDeliveries;

  if (!isShareDelivery(delivery)) {
    const access = await resolveParentMessageAccessFromFeed(
      delivery.id,
      recipientKeyId,
      allDeliveries,
      manifestLookup,
    );
    if (!access) {
      throw new Error('No key manifest entry for your key.');
    }

    if (access.deliveryMessageId === delivery.id) {
      const entry = await resolveManifestEntry(
        manifestLookup,
        delivery.id,
        recipientKeyId,
      );
      if (!entry) {
        throw new Error('Missing key manifest shard.');
      }
      const assembled = assembleStoredMessagePayloadFromEntry(
        delivery.payload,
        recipientKeyId,
        entry,
      );
      const plaintext = await decryptWithManifestWithAgree(
        assembled,
        recipientKeyId,
        oracle.agreeSharedSecret,
      );
      return { plaintext };
    }

    const plaintext = await decryptSharedStoredMessageWithAgree(
      access.deliveryMessageId,
      access.parentMessageId,
      access.deliveryCorePayloadJson,
      access.parentCorePayloadJson,
      recipientKeyId,
      oracle.agreeSharedSecret,
      manifestLookup,
    );
    return { plaintext };
  }

  const parent = allDeliveries.find(
    (row) => row.id === delivery.messageId && !isShareDelivery(row),
  );
  if (!parent || isShareDelivery(parent)) {
    throw new Error('Parent message not found in inbox cache.');
  }

  const plaintext = await decryptSharedStoredMessageWithAgree(
    delivery.id,
    delivery.messageId,
    delivery.payload,
    parent.payload,
    recipientKeyId,
    oracle.agreeSharedSecret,
    manifestLookup,
  );
  return { plaintext };
}

export async function bridgeDecryptComment(
  oracle: BridgeOracleCallbacks,
  recipientKeyId: string,
  payload: FeedLabBridgeDecryptCommentPayload,
): Promise<{ plaintext: string }> {
  const manifestLookup = buildManifestLookupFromWire(payload.manifestEntries);
  const comment = payload.comment;
  const parsed = parseBaseJsonObjectOrThrow(
    comment.payload,
  ) as unknown as CommentPayload;

  if (parsed.messageId !== comment.messageId) {
    throw new Error('Comment messageId does not match the parent message.');
  }

  await verifyCommentSignature(parsed);

  const access = await resolveParentMessageAccessFromFeed(
    comment.messageId,
    recipientKeyId,
    payload.allDeliveries,
    manifestLookup,
  );
  if (!access) {
    throw new Error('Cannot decrypt comment — no message access.');
  }

  const rawDek = await decryptParentMessageDekFromAccessWithAgree(
    access,
    recipientKeyId,
    oracle.agreeSharedSecret,
    manifestLookup,
  );
  const commentKey = await deriveCommentKeyFromDek(
    rawDek,
    parseCommentHkdfSalt(parsed.salt),
  );

  const plaintext = await aesGcmDecryptManifestBody(
    commentKey,
    parseEncryptedContentWire(parsed.encryptedContent),
  );
  return { plaintext };
}

export async function bridgeDecryptComments(
  oracle: BridgeOracleCallbacks,
  recipientKeyId: string,
  payload: FeedLabBridgeDecryptCommentsPayload,
): Promise<{ decrypted: Record<string, string> }> {
  const decrypted: Record<string, string> = {};

  for (const comment of payload.comments) {
    try {
      const result = await bridgeDecryptComment(oracle, recipientKeyId, {
        comment,
        allDeliveries: payload.allDeliveries,
        manifestEntries: payload.manifestEntries,
      });
      decrypted[comment.id] = result.plaintext;
    } catch {
      // Skip comments that cannot be decrypted.
    }
  }

  return { decrypted };
}

export function createBridgeOracleFromRequest(
  requestOracle: <T>(
    op: 'ecdh-agree' | 'ecdsa-sign',
    payload: unknown,
  ) => Promise<T>,
): BridgeOracleCallbacks {
  return {
    async agreeSharedSecret(peerPublicJwk) {
      const result = await requestOracle<{ sharedSecret: string }>(
        'ecdh-agree',
        { peerPublicJwk },
      );
      const bytes = base64ToBytes(result.sharedSecret);
      return new Uint8Array(bytes).buffer;
    },
    async signCanonical(signable) {
      const result = await requestOracle<{ signature: string }>('ecdsa-sign', {
        signable,
      });
      return result.signature;
    },
  };
}
