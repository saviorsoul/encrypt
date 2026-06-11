import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import { parseManifestPayload } from '@/crypto/manifestDecrypt.ts';
import { listOneToOneMessagesForThread } from '@/crypto/storedOneToOneMessages.ts';
import type { PartyKeyIds } from '@/types/oneToOne.ts';

export type MessagePartyKeyIds = {
  senderKeyId: string;
  recipientKeyId: string;
};

export async function getMessagePartyKeyIdsFromPayload(
  payloadJson: string,
): Promise<MessagePartyKeyIds> {
  const manifest = parseManifestPayload(payloadJson);
  const senderKeyId = await ecPublicJwkThumbprintSha256(
    slimEcPublicJwk(manifest.senderPublicJwk),
  );
  const keyIds = Object.keys(manifest.keyManifest);

  if (keyIds.length !== 2) {
    throw new Error('Expected a 1-to-1 message with exactly two parties.');
  }

  const recipientKeyId = keyIds.find((keyId) => keyId !== senderKeyId);
  if (!recipientKeyId) {
    throw new Error('Could not resolve message parties from key manifest.');
  }

  return { senderKeyId, recipientKeyId };
}

export function messageBelongsToConversation(
  messageParties: MessagePartyKeyIds,
  partyKeyIds: PartyKeyIds,
): boolean {
  const { senderKeyId, recipientKeyId } = partyKeyIds;
  if (!senderKeyId || !recipientKeyId) {
    return false;
  }

  const messagePartySet = new Set([
    messageParties.senderKeyId,
    messageParties.recipientKeyId,
  ]);
  return (
    messagePartySet.has(senderKeyId) && messagePartySet.has(recipientKeyId)
  );
}

export function getPeerKeyIdForViewer(
  viewerKeyId: string,
  messageParties: MessagePartyKeyIds,
): string {
  if (viewerKeyId === messageParties.senderKeyId) {
    return messageParties.recipientKeyId;
  }
  if (viewerKeyId === messageParties.recipientKeyId) {
    return messageParties.senderKeyId;
  }

  throw new Error('Your public key is not a party to this message.');
}

export function getPublicJwkFromManifestForKeyId(
  payloadJson: string,
  keyId: string,
): JsonWebKey {
  const manifest = parseManifestPayload(payloadJson);
  const entry = manifest.keyManifest[keyId];
  const publicJwk = entry?.publicKey;

  if (!publicJwk) {
    throw new Error(`Missing public key in manifest for party ${keyId}.`);
  }

  return slimEcPublicJwk(publicJwk);
}

export async function recoverPeerPublicJwkFromStoredThread(
  viewerKeyId: string,
  peerKeyId: string,
): Promise<JsonWebKey | null> {
  const messages = await listOneToOneMessagesForThread(viewerKeyId, peerKeyId);
  const firstMessage = messages[0];
  if (!firstMessage) {
    return null;
  }

  try {
    return getPublicJwkFromManifestForKeyId(
      firstMessage.encryptedPayload,
      peerKeyId,
    );
  } catch {
    return null;
  }
}

export async function resolvePeerPublicJwk(
  viewerKeyId: string,
  peerKeyId: string,
  payloadJson?: string,
): Promise<JsonWebKey | null> {
  if (payloadJson) {
    return getPublicJwkFromManifestForKeyId(payloadJson, peerKeyId);
  }

  return recoverPeerPublicJwkFromStoredThread(viewerKeyId, peerKeyId);
}
