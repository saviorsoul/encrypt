import { bytesToBase64, base64ToBytes } from '../utils/bytes.ts';
import { importPublicKeyExtractable } from '../crypto/ecdhKeys.ts';
import { jwkWithoutKeyOps } from '../crypto/ecdhKeys.ts';
import { assertBrowserSubtleCrypto } from '../crypto/webCryptoContext.ts';

export type FeedBridgeSessionEnvelope = {
  ephemeralPublicJwk: JsonWebKey;
  iv: string;
  ciphertext: string;
};

export type FeedBridgeEncryptedStorageRecord = {
  sessionKeyId: string;
  envelope?: FeedBridgeSessionEnvelope;
  error?: string;
};

export async function generateFeedBridgeSessionKeyPair(): Promise<{
  sessionKeyId: string;
  publicJwk: JsonWebKey;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}> {
  assertBrowserSubtleCrypto();
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
  const publicJwk = jwkWithoutKeyOps(
    await crypto.subtle.exportKey('jwk', keyPair.publicKey),
  );
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits'],
  );
  const sessionKeyId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    sessionKeyId,
    publicJwk,
    privateKey,
    publicKey: keyPair.publicKey,
  };
}

async function deriveAesGcmKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

export async function encryptFeedBridgeSessionPayload(
  sessionPublicKey: CryptoKey,
  payload: unknown,
): Promise<FeedBridgeSessionEnvelope> {
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
  const aesKey = await deriveAesGcmKey(ephemeral.privateKey, sessionPublicKey, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext,
  );
  return {
    ephemeralPublicJwk: jwkWithoutKeyOps(
      await crypto.subtle.exportKey('jwk', ephemeral.publicKey),
    ),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptFeedBridgeSessionPayload<T>(
  sessionPrivateKey: CryptoKey,
  envelope: FeedBridgeSessionEnvelope,
): Promise<T> {
  const peerPublic = await importPublicKeyExtractable(
    envelope.ephemeralPublicJwk,
  );
  const aesKey = await deriveAesGcmKey(sessionPrivateKey, peerPublic, [
    'decrypt',
  ]);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.slice().buffer },
    aesKey,
    ciphertext.slice().buffer,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
