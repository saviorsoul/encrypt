import {
  ecPublicJwkThumbprintSha256,
  slimEcPrivateJwk,
} from '@/crypto/jwkThumbprint.ts';
import {
  encryptWithManifest,
  exportCryptoKeyAsJwk,
} from '@/crypto/manifestEncrypt.ts';
import { importUploadedPrivateKeyMaterial } from '@/crypto/privateKeyMaterial.ts';

export const DEMO_PARENT_MESSAGE_ID = 'poc-feed-message-001';

export const DEMO_PARENT_FEED_PLAINTEXT =
  'This feed post was encrypted earlier. You are adding a comment under the same message DEK.';

export type DemoParentFeedMessage = {
  messageId: string;
  parentPayload: string;
  parentPlaintext: string;
  /** Current user — recipient on the parent post and comment author. */
  recipientKeyId: string;
};

const sessionByRecipientKeyId = new Map<
  string,
  Promise<DemoParentFeedMessage>
>();

/** Ephemeral feed post sender (demo only; not the comment author). */
async function createDemoFeedAuthorKeys(): Promise<{
  publicKey: CryptoKey;
  signingPrivateKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
  const privateJwk = slimEcPrivateJwk(
    await crypto.subtle.exportKey('jwk', keyPair.privateKey),
  );
  const material = await importUploadedPrivateKeyMaterial(privateJwk);
  return {
    publicKey: keyPair.publicKey,
    signingPrivateKey: material.ecdsaSignPrivateKey,
  };
}

async function createDemoParentFeedMessage(
  recipientKeyId: string,
  recipientPublicKey: CryptoKey,
): Promise<DemoParentFeedMessage> {
  const feedAuthor = await createDemoFeedAuthorKeys();
  const parentPayload = await encryptWithManifest(
    DEMO_PARENT_FEED_PLAINTEXT,
    [{ keyId: recipientKeyId, publicKey: recipientPublicKey }],
    feedAuthor.publicKey,
    feedAuthor.signingPrivateKey,
  );

  return {
    messageId: DEMO_PARENT_MESSAGE_ID,
    parentPayload,
    parentPlaintext: DEMO_PARENT_FEED_PLAINTEXT,
    recipientKeyId,
  };
}

/** Session-scoped demo feed post addressed to the current user. */
export async function loadDemoParentFeedMessage(
  recipientPublicKey: CryptoKey,
): Promise<DemoParentFeedMessage> {
  const recipientPublicJwk = await exportCryptoKeyAsJwk(recipientPublicKey);
  const recipientKeyId = await ecPublicJwkThumbprintSha256(recipientPublicJwk);

  let cached = sessionByRecipientKeyId.get(recipientKeyId);
  if (!cached) {
    cached = createDemoParentFeedMessage(
      recipientKeyId,
      recipientPublicKey,
    ).catch((error) => {
      sessionByRecipientKeyId.delete(recipientKeyId);
      throw error;
    });
    sessionByRecipientKeyId.set(recipientKeyId, cached);
  }

  return cached;
}
