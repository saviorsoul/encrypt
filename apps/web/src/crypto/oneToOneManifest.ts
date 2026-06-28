import { importPublicKeyExtractable } from '@/crypto/ecdhKeys.ts';
import { ecPublicJwkThumbprintFromCryptoKey } from '@/crypto/jwkThumbprint.ts';
import type { ManifestPayload } from '@/types/manifest.ts';
import type { ThreadSide } from '@/types/oneToOne.ts';

export async function resolveMessageSideFromManifestSender(
  manifest: ManifestPayload,
  senderKeyId: string | null,
  recipientKeyId: string | null,
): Promise<ThreadSide> {
  const manifestSenderKey = await importPublicKeyExtractable(
    manifest.senderPublicJwk,
  );
  const manifestSenderKeyId =
    await ecPublicJwkThumbprintFromCryptoKey(manifestSenderKey);

  if (senderKeyId && manifestSenderKeyId === senderKeyId) {
    return 'sender';
  }
  if (recipientKeyId && manifestSenderKeyId === recipientKeyId) {
    return 'recipient';
  }

  throw new Error(
    'Manifest sender does not match the sender or recipient publicKeyJwk.',
  );
}
