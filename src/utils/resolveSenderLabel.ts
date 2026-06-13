import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import { listStoredUsers } from '@/crypto/storedPublicKeys.ts';
import { parseImportPayloadText } from '@/utils/parseImportPayloadText.ts';

export const UNKNOWN_SENDER_LABEL = 'Not known';

export async function resolveUsernameForKeyId(
  keyId: string | null,
): Promise<string> {
  if (!keyId) {
    return UNKNOWN_SENDER_LABEL;
  }

  const users = await listStoredUsers();
  const match = users.find((user) => user.keyId === keyId);
  return match?.username ?? UNKNOWN_SENDER_LABEL;
}

export async function resolveSenderLabelFromImportText(
  manifestText: string,
): Promise<string> {
  const parsed = parseImportPayloadText(manifestText);
  if (parsed.ok === false) {
    return UNKNOWN_SENDER_LABEL;
  }

  if (parsed.payload.kind === 'share') {
    const parent = JSON.parse(parsed.payload.parentCorePayloadJson) as {
      senderPublicJwk?: JsonWebKey;
    };
    if (!parent.senderPublicJwk) {
      return UNKNOWN_SENDER_LABEL;
    }
    const senderKeyId = await ecPublicJwkThumbprintSha256(
      parent.senderPublicJwk,
    );
    return resolveUsernameForKeyId(senderKeyId);
  }

  const manifest = JSON.parse(parsed.payload.fullPayloadJson) as {
    senderPublicJwk?: JsonWebKey;
  };
  if (!manifest.senderPublicJwk) {
    return UNKNOWN_SENDER_LABEL;
  }

  const senderKeyId = await ecPublicJwkThumbprintSha256(
    manifest.senderPublicJwk,
  );
  return resolveUsernameForKeyId(senderKeyId);
}

/** @deprecated Use resolveSenderLabelFromImportText */
export async function resolveSenderLabelFromManifestText(
  manifestText: string,
): Promise<string> {
  return resolveSenderLabelFromImportText(manifestText);
}
