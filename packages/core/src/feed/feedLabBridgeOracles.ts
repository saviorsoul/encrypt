import { bytesToBase64 } from '../utils/bytes.ts';
import { deriveEcdhSharedSecretBits } from '../crypto/manifestEncrypt.ts';
import { importPublicKeyExtractable } from '../crypto/ecdhKeys.ts';
import { signCanonicalBody } from '../crypto/manifestSign.ts';
import type { UploadedPrivateKeyMaterial } from '../crypto/privateKeyMaterial.ts';
import {
  parseFeedLabBridgeQuickOpPayload,
  quickOpPayloadToSignable,
} from './feedLabBridgeQuickOp.ts';
import type {
  FeedLabBridgeEcdhAgreePayload,
  FeedLabBridgeEcdhAgreeResult,
  FeedLabBridgeEcdsaSignPayload,
  FeedLabBridgeEcdsaSignResult,
  FeedLabBridgeOracleOp,
} from './feedLabBridge.ts';

export async function executeFeedLabBridgeOracle(
  material: UploadedPrivateKeyMaterial,
  op: FeedLabBridgeOracleOp,
  payload: unknown,
): Promise<FeedLabBridgeEcdhAgreeResult | FeedLabBridgeEcdsaSignResult> {
  switch (op) {
    case 'ecdh-agree':
      return executeEcdhAgree(material, payload as FeedLabBridgeEcdhAgreePayload);
    case 'ecdsa-sign':
      return executeEcdsaSign(material, payload as FeedLabBridgeEcdsaSignPayload);
    case 'op-quick':
      return executeOpQuick(material, payload);
    default: {
      const exhaustive: never = op;
      throw new Error(`Unknown feed bridge oracle: ${exhaustive}`);
    }
  }
}

async function executeEcdhAgree(
  material: UploadedPrivateKeyMaterial,
  payload: FeedLabBridgeEcdhAgreePayload,
): Promise<FeedLabBridgeEcdhAgreeResult> {
  const peerPublic = await importPublicKeyExtractable(payload.peerPublicJwk);
  const sharedSecret = await deriveEcdhSharedSecretBits(
    peerPublic,
    material.ecdhPrivateKey,
  );
  return { sharedSecret: bytesToBase64(new Uint8Array(sharedSecret)) };
}

async function executeEcdsaSign(
  material: UploadedPrivateKeyMaterial,
  payload: FeedLabBridgeEcdsaSignPayload,
): Promise<FeedLabBridgeEcdsaSignResult> {
  const signature = await signCanonicalBody(
    material.ecdsaSignPrivateKey,
    payload.signable,
  );
  return { signature };
}

async function executeOpQuick(
  material: UploadedPrivateKeyMaterial,
  payload: unknown,
): Promise<FeedLabBridgeEcdsaSignResult> {
  const parsed = parseFeedLabBridgeQuickOpPayload(payload);
  if (!parsed) {
    throw new Error('Invalid op-quick payload.');
  }
  if (parsed.auth.keyId !== material.keyId) {
    throw new Error('op-quick keyId does not match the paired Encrypt identity.');
  }

  const signature = await signCanonicalBody(
    material.ecdsaSignPrivateKey,
    quickOpPayloadToSignable(parsed),
  );
  return { signature };
}
