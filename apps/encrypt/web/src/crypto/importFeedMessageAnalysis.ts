import { recipientHasAccessToParentMessage } from '@/crypto/manifestShare.ts';
import {
  encryptedMessageFingerprintFromPayloadJson,
  encryptedMessageFingerprintsMatch,
  type EncryptedMessageFingerprint,
} from '@/types/oneToOne.ts';
import type {
  ParsedBundledCommentImport,
  ParsedOriginalImportPayload,
  ParsedShareImportPayload,
} from '@/utils/parseImportPayloadText.ts';
import type { StoredMessage } from '@/services/db/storedMessages.ts';
import { getStoredMessageById } from '@/services/db/storedMessages.ts';
import {
  listCommentsForMessage,
  type StoredComment,
} from '@/services/db/storedComments.ts';

function findDuplicateMessageId(
  messages: StoredMessage[],
  fingerprint: EncryptedMessageFingerprint,
): string | null {
  for (const message of messages) {
    const existing = encryptedMessageFingerprintFromPayloadJson(
      message.payload,
    );
    if (
      existing !== null &&
      encryptedMessageFingerprintsMatch(existing, fingerprint)
    ) {
      return message.id;
    }
  }
  return null;
}

async function resolveExistingOriginalMessage(
  payload: ParsedOriginalImportPayload,
  existingMessages: StoredMessage[],
): Promise<StoredMessage | null> {
  if (payload.exportedMessageId) {
    const byId = await getStoredMessageById(payload.exportedMessageId);
    if (byId) {
      return byId;
    }
  }

  const fingerprint = encryptedMessageFingerprintFromPayloadJson(
    payload.fullPayloadJson,
  );
  if (fingerprint === null) {
    return null;
  }

  const duplicateId = findDuplicateMessageId(existingMessages, fingerprint);
  if (duplicateId === null) {
    return null;
  }

  return getStoredMessageById(duplicateId);
}

function bundledCommentStoredStatus(
  bundled: ParsedBundledCommentImport,
  existingComments: StoredComment[],
): 'missing' | 'present' | 'conflict' {
  const payloadJson = JSON.stringify(bundled.payload);
  const byId = existingComments.find((comment) => comment.id === bundled.id);
  if (byId) {
    return byId.payload === payloadJson ? 'present' : 'conflict';
  }

  if (existingComments.some((comment) => comment.payload === payloadJson)) {
    return 'present';
  }

  return 'missing';
}

function bundledCommentMatchesMessage(
  bundled: ParsedBundledCommentImport,
  existingMessage: StoredMessage,
  exportedMessageId?: string,
): boolean {
  const commentMessageId = bundled.payload.messageId;
  if (commentMessageId === existingMessage.id) {
    return true;
  }

  return (
    exportedMessageId !== undefined && commentMessageId === exportedMessageId
  );
}

type BundledCommentsPlan =
  | {
      mode: 'comments-only';
      missingComments: ParsedBundledCommentImport[];
    }
  | { mode: 'blocked'; error: string };

async function planBundledCommentsForExistingMessage(
  bundledComments: ParsedBundledCommentImport[],
  existingMessage: StoredMessage,
  exportedMessageId?: string,
): Promise<BundledCommentsPlan> {
  if (bundledComments.length === 0) {
    return {
      mode: 'blocked',
      error: 'This message is already in your feed.',
    };
  }

  const existingComments = await listCommentsForMessage(existingMessage.id);
  const missingComments: ParsedBundledCommentImport[] = [];

  for (const bundledComment of bundledComments) {
    if (
      !bundledCommentMatchesMessage(
        bundledComment,
        existingMessage,
        exportedMessageId,
      )
    ) {
      return {
        mode: 'blocked',
        error:
          'Bundled comments do not match the message already in your feed.',
      };
    }

    const status = bundledCommentStoredStatus(bundledComment, existingComments);
    if (status === 'conflict') {
      return {
        mode: 'blocked',
        error: `Comment ${bundledComment.id} conflicts with stored data.`,
      };
    }

    if (status === 'missing') {
      missingComments.push(bundledComment);
    }
  }

  if (missingComments.length === 0) {
    return {
      mode: 'blocked',
      error: 'This message and all bundled comments are already in your feed.',
    };
  }

  return { mode: 'comments-only', missingComments };
}

export async function listMissingBundledComments(
  bundledComments: ParsedBundledCommentImport[],
  parentMessageId: string,
): Promise<ParsedBundledCommentImport[]> {
  if (bundledComments.length === 0) {
    return [];
  }

  const existingComments = await listCommentsForMessage(parentMessageId);
  return bundledComments.filter(
    (bundled) =>
      bundled.payload.messageId === parentMessageId &&
      bundledCommentStoredStatus(bundled, existingComments) === 'missing',
  );
}

export type OriginalImportPlan =
  | { mode: 'full' }
  | {
      mode: 'comments-only';
      existingMessage: StoredMessage;
      missingComments: ParsedBundledCommentImport[];
    }
  | { mode: 'blocked'; error: string };

export async function planOriginalImport(
  payload: ParsedOriginalImportPayload,
  existingMessages: StoredMessage[],
): Promise<OriginalImportPlan> {
  const existingMessage = await resolveExistingOriginalMessage(
    payload,
    existingMessages,
  );

  if (!existingMessage) {
    return { mode: 'full' };
  }

  const commentsPlan = await planBundledCommentsForExistingMessage(
    payload.comments ?? [],
    existingMessage,
    payload.exportedMessageId,
  );

  if (commentsPlan.mode === 'blocked') {
    return commentsPlan;
  }

  return {
    mode: 'comments-only',
    existingMessage,
    missingComments: commentsPlan.missingComments,
  };
}

export type ShareImportPlan =
  | { mode: 'full' }
  | {
      mode: 'comments-only';
      parentMessage: StoredMessage;
      missingComments: ParsedBundledCommentImport[];
    }
  | { mode: 'blocked'; error: string };

export async function planShareImport(
  payload: ParsedShareImportPayload,
  recipientKeyId: string,
): Promise<ShareImportPlan> {
  const parentMessage = await getStoredMessageById(payload.parentMessageId);
  const hasAccess = await recipientHasAccessToParentMessage(
    payload.parentMessageId,
    recipientKeyId,
  );

  if (!hasAccess) {
    return { mode: 'full' };
  }

  if (!parentMessage) {
    return {
      mode: 'blocked',
      error: 'Parent message not found.',
    };
  }

  const commentsPlan = await planBundledCommentsForExistingMessage(
    payload.comments ?? [],
    parentMessage,
    payload.parentMessageId,
  );

  if (commentsPlan.mode === 'blocked') {
    if (
      commentsPlan.error === 'This message is already in your feed.' &&
      (payload.comments?.length ?? 0) === 0
    ) {
      return {
        mode: 'blocked',
        error: 'You already have access to this message in your feed.',
      };
    }
    return commentsPlan;
  }

  return {
    mode: 'comments-only',
    parentMessage,
    missingComments: commentsPlan.missingComments,
  };
}
