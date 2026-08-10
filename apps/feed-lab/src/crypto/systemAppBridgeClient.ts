import { importPublicKeyExtractable } from '@encrypt/core/crypto/ecdhKeys';
import { slimEcPublicJwk } from '@encrypt/core/crypto/jwkThumbprint';
import type { AuthPublicKeyCoords } from '@encrypt/core/crypto/authProof';
import type { FeedLabBridgePairing } from '@encrypt/core/feed/feedLabBridge';
import {
  bridgeDecryptComment,
  bridgeDecryptComments,
  bridgeDecryptMessage,
  bridgeEncryptComment,
  bridgeEncryptShare,
  bridgeEncryptMessage,
  createBridgeOracleFromRequest,
  type FeedLabBridgeDecryptCommentPayload,
  type FeedLabBridgeDecryptCommentsPayload,
  type FeedLabBridgeDecryptMessagePayload,
  type FeedLabBridgeEncryptCommentPayload,
  type FeedLabBridgeEncryptMessagePayload,
  type FeedLabBridgeEncryptSharePayload,
} from '@encrypt/core/feed/feedLabBridgeClientCrypto';
import { loadFeedLabBridgePairing } from '@lab/crypto/systemAppPairingStorage.ts';
import { requestBridgeOracle } from '@lab/crypto/systemAppSigner.ts';

export type FeedLabBridgeEncryptMessageResult = {
  body: Record<string, unknown>;
};
export type FeedLabBridgeEncryptShareResult = {
  shareCoreJson: string;
  keyManifest: Record<string, unknown>;
};
export type FeedLabBridgeEncryptCommentResult = {
  payload: Record<string, unknown>;
};

async function importPairingSenderPublicKey(
  publicKey: AuthPublicKeyCoords,
): Promise<CryptoKey> {
  return importPublicKeyExtractable(
    slimEcPublicJwk({
      kty: 'EC',
      crv: 'P-256',
      x: publicKey.x,
      y: publicKey.y,
    }),
  );
}

function requirePairing(): FeedLabBridgePairing {
  const pairing = loadFeedLabBridgePairing();
  if (!pairing) {
    throw new Error(
      'Encrypt app is not paired. Connect the Encrypt app first.',
    );
  }
  return pairing;
}

function createOracle() {
  return createBridgeOracleFromRequest(requestBridgeOracle);
}

export async function systemEncryptMessage(
  payload: FeedLabBridgeEncryptMessagePayload,
): Promise<FeedLabBridgeEncryptMessageResult> {
  const pairing = requirePairing();
  const senderPublicKey = await importPairingSenderPublicKey(pairing.publicKey);
  return bridgeEncryptMessage(createOracle(), senderPublicKey, payload);
}

export async function systemEncryptShare(
  payload: FeedLabBridgeEncryptSharePayload,
): Promise<FeedLabBridgeEncryptShareResult> {
  const pairing = requirePairing();
  const senderPublicKey = await importPairingSenderPublicKey(pairing.publicKey);
  return bridgeEncryptShare(
    createOracle(),
    pairing.keyId,
    senderPublicKey,
    payload,
  );
}

export async function systemEncryptComment(
  payload: FeedLabBridgeEncryptCommentPayload,
): Promise<FeedLabBridgeEncryptCommentResult> {
  const pairing = requirePairing();
  const senderPublicKey = await importPairingSenderPublicKey(pairing.publicKey);
  return bridgeEncryptComment(
    createOracle(),
    pairing.keyId,
    senderPublicKey,
    payload,
  );
}

export async function systemDecryptMessage(
  payload: FeedLabBridgeDecryptMessagePayload,
): Promise<{ plaintext: string }> {
  const pairing = requirePairing();
  return bridgeDecryptMessage(createOracle(), pairing.keyId, payload);
}

export async function systemDecryptComment(
  payload: FeedLabBridgeDecryptCommentPayload,
): Promise<{ plaintext: string }> {
  const pairing = requirePairing();
  return bridgeDecryptComment(createOracle(), pairing.keyId, payload);
}

export async function systemDecryptComments(
  payload: FeedLabBridgeDecryptCommentsPayload,
): Promise<{ decrypted: Record<string, string> }> {
  const pairing = requirePairing();
  return bridgeDecryptComments(createOracle(), pairing.keyId, payload);
}

export type {
  FeedLabBridgeDecryptCommentPayload,
  FeedLabBridgeDecryptCommentsPayload,
  FeedLabBridgeDecryptMessagePayload,
  FeedLabBridgeEncryptCommentPayload,
  FeedLabBridgeEncryptMessagePayload,
  FeedLabBridgeEncryptSharePayload,
};
