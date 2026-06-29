import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import { listStoredUsers } from '@/services/db/storedPublicKeys.ts';
import { parseImportPayloadText } from '@/utils/parseImportPayloadText.ts';
import { validateBaseJsonText } from '@/utils/validateBaseJsonText.ts';

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
    const shareBase = validateBaseJsonText(
      JSON.stringify(parsed.payload.share),
    );
    if (shareBase.ok === false || !shareBase.parsed.sharerPublicJwk) {
      return UNKNOWN_SENDER_LABEL;
    }
    const senderKeyId = await ecPublicJwkThumbprintSha256(
      shareBase.parsed.sharerPublicJwk as JsonWebKey,
    );
    return resolveUsernameForKeyId(senderKeyId);
  }

  const manifestBase = validateBaseJsonText(parsed.payload.fullPayloadJson);
  if (manifestBase.ok === false || !manifestBase.parsed.senderPublicJwk) {
    return UNKNOWN_SENDER_LABEL;
  }

  const senderKeyId = await ecPublicJwkThumbprintSha256(
    manifestBase.parsed.senderPublicJwk as JsonWebKey,
  );
  return resolveUsernameForKeyId(senderKeyId);
}

/** @deprecated Use resolveSenderLabelFromImportText */
export async function resolveSenderLabelFromManifestText(
  manifestText: string,
): Promise<string> {
  return resolveSenderLabelFromImportText(manifestText);
}
