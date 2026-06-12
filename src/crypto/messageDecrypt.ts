import { decryptComment } from '@/crypto/commentCrypto.ts';
import { decryptWithManifest } from '@/crypto/manifestDecrypt.ts';
import {
  commentVisibleToRecipient,
  listCommentsForMessage,
} from '@/crypto/storedComments.ts';
import {
  decryptStoredDeliveryWithPrivateKey,
  getCommentThreadMessageId,
} from '@/crypto/manifestShare.ts';
import {
  getStoredMessageById,
  type StoredMessage,
} from '@/crypto/storedMessages.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import { withUploadedPrivateKey } from '@/crypto/privateKeyFile.ts';
import { logError } from '@/utils/logError.ts';
import { errorMessage } from '@/utils/errorMessage.ts';

export type MessageDecryptionResult = {
  text: string | null;
  error: string | null;
};

export type DecryptableMessage = StoredMessage;

export type DecryptableComment = {
  id: string;
  messageId: string;
  payload: string;
};

export async function verifyUploadedPrivateKey(
  jwk: JsonWebKey,
  recipientKeyId: string,
): Promise<void> {
  const uploadedKeyId = await ecPublicJwkThumbprintSha256(slimEcPublicJwk(jwk));
  if (uploadedKeyId !== recipientKeyId) {
    throw new Error(
      'Uploaded private key does not match the publicKeyJwk for this side.',
    );
  }
}

export async function decryptMessageWithUploadedPrivateKey(
  payload: string,
  recipientKeyId: string,
): Promise<string> {
  return withUploadedPrivateKey(async (privateKey, jwk) => {
    await verifyUploadedPrivateKey(jwk, recipientKeyId);
    return decryptWithManifest(payload, privateKey, recipientKeyId);
  });
}

export async function listDecryptableCommentsForMessage(
  messageId: string,
  recipientKeyId: string,
): Promise<DecryptableComment[]> {
  const stored = await listCommentsForMessage(messageId);
  const decryptable: DecryptableComment[] = [];

  for (const comment of stored) {
    if (
      await commentVisibleToRecipient(
        comment.messageId,
        comment.payload,
        recipientKeyId,
      )
    ) {
      decryptable.push({
        id: comment.id,
        messageId: comment.messageId,
        payload: comment.payload,
      });
    }
  }

  return decryptable;
}

async function decryptCommentsWithPrivateKey(
  comments: DecryptableComment[],
  recipientKeyId: string,
  privateKey: CryptoKey,
  seedMessageCoreById?: Map<string, string>,
): Promise<Record<string, MessageDecryptionResult>> {
  const messageCoreById = new Map(seedMessageCoreById);
  const results: Record<string, MessageDecryptionResult> = {};

  for (const comment of comments) {
    try {
      let messageCorePayload = messageCoreById.get(comment.messageId);
      if (messageCorePayload === undefined) {
        const parentMessage = await getStoredMessageById(comment.messageId);
        if (!parentMessage) {
          throw new Error(`Message not found: ${comment.messageId}`);
        }
        messageCorePayload = parentMessage.payload;
        messageCoreById.set(comment.messageId, messageCorePayload);
      }

      const text = await decryptComment(
        comment.payload,
        comment.messageId,
        messageCorePayload,
        recipientKeyId,
        privateKey,
      );
      results[comment.id] = { text, error: null };
    } catch (e) {
      logError('decryptCommentsWithPrivateKey', e, {
        commentId: comment.id,
        messageId: comment.messageId,
      });
      results[comment.id] = {
        text: null,
        error: errorMessage(e, 'Decryption failed.'),
      };
    }
  }

  return results;
}

export async function decryptStoredMessageAndCommentsWithUploadedPrivateKey(
  message: StoredMessage,
  recipientKeyId: string,
): Promise<{
  message: MessageDecryptionResult;
  comments: Record<string, MessageDecryptionResult>;
}> {
  return withUploadedPrivateKey(async (privateKey, jwk) => {
    await verifyUploadedPrivateKey(jwk, recipientKeyId);

    let messageResult: MessageDecryptionResult;
    try {
      const text = await decryptStoredDeliveryWithPrivateKey(
        message,
        recipientKeyId,
        privateKey,
      );
      messageResult = { text, error: null };
    } catch (e) {
      logError('decryptStoredMessageAndComments', e, {
        messageId: message.id,
        recipientKeyId,
      });
      messageResult = {
        text: null,
        error: errorMessage(e, 'Decryption failed.'),
      };
    }

    const commentThreadId = getCommentThreadMessageId(message);
    const comments = await listDecryptableCommentsForMessage(
      commentThreadId,
      recipientKeyId,
    );
    const parentMessage = await getStoredMessageById(commentThreadId);
    const messageCoreById = new Map<string, string>();
    if (parentMessage) {
      messageCoreById.set(commentThreadId, parentMessage.payload);
    }

    const commentResults = await decryptCommentsWithPrivateKey(
      comments,
      recipientKeyId,
      privateKey,
      messageCoreById,
    );

    return { message: messageResult, comments: commentResults };
  });
}

export type InboxDecryptionResults = {
  messages: Record<string, MessageDecryptionResult>;
  commentsByMessageId: Record<string, Record<string, MessageDecryptionResult>>;
};

async function decryptMessagesWithPrivateKey(
  messages: DecryptableMessage[],
  recipientKeyId: string,
  privateKey: CryptoKey,
): Promise<Record<string, MessageDecryptionResult>> {
  const messageResults: Record<string, MessageDecryptionResult> = {};

  for (const message of messages) {
    try {
      const text = await decryptStoredDeliveryWithPrivateKey(
        message,
        recipientKeyId,
        privateKey,
      );
      messageResults[message.id] = { text, error: null };
    } catch (e) {
      logError('decryptMessagesWithPrivateKey', e, {
        messageId: message.id,
        recipientKeyId,
      });
      messageResults[message.id] = {
        text: null,
        error: errorMessage(e, 'Decryption failed.'),
      };
    }
  }

  return messageResults;
}

export async function decryptMessagesWithUploadedPrivateKey(
  messages: DecryptableMessage[],
  recipientKeyId: string,
): Promise<Record<string, MessageDecryptionResult>> {
  return withUploadedPrivateKey(async (privateKey, jwk) => {
    await verifyUploadedPrivateKey(jwk, recipientKeyId);
    return decryptMessagesWithPrivateKey(messages, recipientKeyId, privateKey);
  });
}

export async function decryptMessagesAndCommentsWithUploadedPrivateKey(
  messages: DecryptableMessage[],
  recipientKeyId: string,
): Promise<InboxDecryptionResults> {
  return withUploadedPrivateKey(async (privateKey, jwk) => {
    await verifyUploadedPrivateKey(jwk, recipientKeyId);

    const messageResults = await decryptMessagesWithPrivateKey(
      messages,
      recipientKeyId,
      privateKey,
    );
    const commentsByMessageId: Record<
      string,
      Record<string, MessageDecryptionResult>
    > = {};

    for (const message of messages) {
      const commentThreadId = getCommentThreadMessageId(message);
      const comments = await listDecryptableCommentsForMessage(
        commentThreadId,
        recipientKeyId,
      );
      const parentMessage = await getStoredMessageById(commentThreadId);
      const messageCoreById = new Map<string, string>();
      if (parentMessage) {
        messageCoreById.set(commentThreadId, parentMessage.payload);
      }

      commentsByMessageId[message.id] = await decryptCommentsWithPrivateKey(
        comments,
        recipientKeyId,
        privateKey,
        messageCoreById,
      );
    }

    return { messages: messageResults, commentsByMessageId };
  });
}

export async function decryptCommentsWithUploadedPrivateKey(
  comments: DecryptableComment[],
  recipientKeyId: string,
): Promise<Record<string, MessageDecryptionResult>> {
  if (comments.length === 0) {
    return {};
  }

  return withUploadedPrivateKey(async (privateKey, jwk) => {
    await verifyUploadedPrivateKey(jwk, recipientKeyId);
    return decryptCommentsWithPrivateKey(comments, recipientKeyId, privateKey);
  });
}
