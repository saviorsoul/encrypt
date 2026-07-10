import { verifyManifestShareSignature } from '@/crypto/manifestShare.ts';
import { importBundledComment } from '@/crypto/importComment.ts';
import {
  listMissingBundledComments,
  planOriginalImport,
  planShareImport,
} from '@/crypto/importFeedMessageAnalysis.ts';
import type { ParsedImportPayload } from '@/utils/parseImportPayloadText.ts';
import type { StoredComment } from '@/services/db/storedComments.ts';
import {
  getStoredMessageById,
  saveStoredMessage,
  saveStoredMessageCoreWithId,
  saveStoredMessageWithId,
  type StoredFeedDelivery,
  type StoredMessage,
} from '@/services/db/storedMessages.ts';
import { saveStoredShare } from '@/services/db/storedShares.ts';
import { parseManifestPayload } from '@/crypto/manifestDecrypt.ts';
import { parseManifestCorePayload } from '@/crypto/manifestStorage.ts';
import { verifyManifestSignature } from '@/crypto/manifestSign.ts';

export type FeedMessageImportResult = {
  message: StoredFeedDelivery;
  importedComments: StoredComment[];
};

async function importMissingBundledComments(
  missingComments: Parameters<typeof importBundledComment>[0][],
  recipientKeyId: string,
  parentMessageId: string,
): Promise<StoredComment[]> {
  const importedComments: StoredComment[] = [];
  for (const bundledComment of missingComments) {
    importedComments.push(
      await importBundledComment(
        bundledComment,
        recipientKeyId,
        parentMessageId,
      ),
    );
  }
  return importedComments;
}

async function ensureParentMessageStored(
  parentMessageId: string,
  parentMessageJson: string,
): Promise<StoredMessage> {
  const existing = await getStoredMessageById(parentMessageId);
  if (existing) {
    return existing;
  }

  const parentCore = parseManifestCorePayload(parentMessageJson);
  await verifyManifestSignature(parentCore);
  return saveStoredMessageCoreWithId(parentMessageId, parentMessageJson);
}

export async function importParsedFeedMessage(
  payload: ParsedImportPayload,
  recipientKeyId: string,
  existingMessages: StoredMessage[] = [],
): Promise<FeedMessageImportResult> {
  if (payload.kind === 'original') {
    const manifest = parseManifestPayload(payload.fullPayloadJson);
    await verifyManifestSignature(manifest);

    const plan = await planOriginalImport(payload, existingMessages);
    if (plan.mode === 'blocked') {
      throw new Error(plan.error);
    }
    if (plan.mode === 'comments-only') {
      const importedComments = await importMissingBundledComments(
        plan.missingComments,
        recipientKeyId,
        plan.existingMessage.id,
      );
      return {
        message: plan.existingMessage,
        importedComments,
      };
    }

    let savedMessage: StoredFeedDelivery;
    if (payload.exportedMessageId) {
      const existing = await getStoredMessageById(payload.exportedMessageId);
      if (existing) {
        const replan = await planOriginalImport(payload, existingMessages);
        if (replan.mode === 'comments-only') {
          const importedComments = await importMissingBundledComments(
            replan.missingComments,
            recipientKeyId,
            replan.existingMessage.id,
          );
          return {
            message: replan.existingMessage,
            importedComments,
          };
        }
        throw new Error(
          replan.mode === 'blocked'
            ? replan.error
            : 'This message is already in your feed.',
        );
      }
      savedMessage = await saveStoredMessageWithId(
        payload.exportedMessageId,
        payload.fullPayloadJson,
      );
    } else {
      savedMessage = await saveStoredMessage(payload.fullPayloadJson);
    }

    const importedComments = payload.comments?.length
      ? await importMissingBundledComments(
          payload.comments,
          recipientKeyId,
          savedMessage.id,
        )
      : [];

    return { message: savedMessage, importedComments };
  }

  await verifyManifestShareSignature(payload.share);

  const parentCore = parseManifestCorePayload(payload.parentMessageJson);
  await verifyManifestSignature(parentCore);
  await ensureParentMessageStored(
    payload.parentMessageId,
    payload.parentMessageJson,
  );

  const sharePlan = await planShareImport(payload, recipientKeyId);
  if (sharePlan.mode === 'blocked') {
    throw new Error(sharePlan.error);
  }
  if (sharePlan.mode === 'comments-only') {
    const importedComments = await importMissingBundledComments(
      sharePlan.missingComments,
      recipientKeyId,
      sharePlan.parentMessage.id,
    );
    return {
      message: sharePlan.parentMessage,
      importedComments,
    };
  }

  const shareCoreJson = JSON.stringify(payload.share);
  const share = await saveStoredShare(
    shareCoreJson,
    payload.keyManifest,
    payload.parentMessageId,
  );

  const missingComments = payload.comments?.length
    ? await listMissingBundledComments(
        payload.comments,
        payload.parentMessageId,
      )
    : [];
  const importedComments = missingComments.length
    ? await importMissingBundledComments(
        missingComments,
        recipientKeyId,
        payload.parentMessageId,
      )
    : [];

  return { message: share, importedComments };
}
