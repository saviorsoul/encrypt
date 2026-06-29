import { verifyManifestShareSignature } from '../crypto/manifestShare.ts';
import { parseManifestPayload } from '../crypto/manifestDecrypt.ts';
import { verifyManifestSignature } from '../crypto/manifestSign.ts';
import type { CreateMessageRequest, FeedApi } from '../api/feedApi.ts';
import type { ParsedImportPayload } from './parseImportPayloadText.ts';

export type PostImportResult = {
  kind: 'share' | 'message';
  id: string;
};

export async function verifyParsedImportPayload(
  payload: ParsedImportPayload,
): Promise<void> {
  if (payload.kind === 'original') {
    const manifest = parseManifestPayload(payload.fullPayloadJson);
    await verifyManifestSignature(manifest);
    return;
  }

  await verifyManifestShareSignature(payload.share);
}

export function buildMessagePostBody(
  payload: Extract<ParsedImportPayload, { kind: 'original' }>,
): CreateMessageRequest {
  return JSON.parse(payload.fullPayloadJson) as CreateMessageRequest;
}

export async function postParsedImportToBackend(
  api: FeedApi,
  payload: ParsedImportPayload,
): Promise<PostImportResult> {
  await verifyParsedImportPayload(payload);

  if (payload.kind === 'share') {
    if (!payload.messageId) {
      throw new Error('Share payload is missing messageId.');
    }
    const result = await api.postShare({
      share: payload.share as unknown as Record<string, unknown>,
      keyManifest: payload.keyManifest,
      messageId: payload.messageId,
    });
    return { kind: 'share', id: result.id };
  }

  const result = await api.postMessage(buildMessagePostBody(payload));
  return { kind: 'message', id: result.id };
}

export function validateImportPayloadForRecipient(
  payload: ParsedImportPayload,
  recipientKeyId: string | null,
): string | null {
  if (!recipientKeyId) {
    return 'Load your private key first.';
  }
  if (!(recipientKeyId in payload.keyManifest)) {
    return 'Your public key is not listed as a recipient in this message.';
  }
  return null;
}
