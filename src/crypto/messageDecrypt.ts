import {
  assembleStoredMessagePayload,
  decryptWithManifest,
} from '@/crypto/manifestDecrypt.ts';
import { decryptComment } from '@/crypto/commentCrypto.ts';
import {
  commentVisibleToRecipient,
  listCommentsForMessage,
} from '@/crypto/storedComments.ts';
import { getStoredMessageById } from '@/crypto/storedMessages.ts';
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

export type DecryptableMessage = {
  id: string;
  payload: string;
};

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

export async function decryptStoredMessageWithUploadedPrivateKey(
  messageId: string,
  corePayload: string,
  recipientKeyId: string,
): Promise<string> {
  const assembledPayload = await assembleStoredMessagePayload(
    messageId,
    corePayload,
    recipientKeyId,
  );
  return decryptMessageWithUploadedPrivateKey(assembledPayload, recipientKeyId);
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
  messageId: string,
  corePayload: string,
  comments: DecryptableComment[],
  recipientKeyId: string,
): Promise<{
  message: MessageDecryptionResult;
  comments: Record<string, MessageDecryptionResult>;
}> {
  return withUploadedPrivateKey(async (privateKey, jwk) => {
    await verifyUploadedPrivateKey(jwk, recipientKeyId);

    let message: MessageDecryptionResult;
    try {
      const assembledPayload = await assembleStoredMessagePayload(
        messageId,
        corePayload,
        recipientKeyId,
      );
      const text = await decryptWithManifest(
        assembledPayload,
        privateKey,
        recipientKeyId,
      );
      message = { text, error: null };
    } catch (e) {
      logError('decryptStoredMessageAndComments', e, {
        messageId,
        recipientKeyId,
      });
      message = {
        text: null,
        error: errorMessage(e, 'Decryption failed.'),
      };
    }

    const messageCoreById = new Map<string, string>([[messageId, corePayload]]);
    const commentResults = await decryptCommentsWithPrivateKey(
      comments,
      recipientKeyId,
      privateKey,
      messageCoreById,
    );

    return { message, comments: commentResults };
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
      const assembledPayload = await assembleStoredMessagePayload(
        message.id,
        message.payload,
        recipientKeyId,
      );
      const text = await decryptWithManifest(
        assembledPayload,
        privateKey,
        recipientKeyId,
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
      const comments = await listDecryptableCommentsForMessage(
        message.id,
        recipientKeyId,
      );
      commentsByMessageId[message.id] = await decryptCommentsWithPrivateKey(
        comments,
        recipientKeyId,
        privateKey,
        new Map([[message.id, message.payload]]),
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
