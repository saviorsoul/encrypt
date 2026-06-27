import { useEffect, useState } from 'react';
import {
  getSenderKeyIdFromPayload,
  getStoredMessageById,
  type StoredMessage,
} from '@/services/db/storedMessages.ts';
import {
  getSharerKeyIdFromSharePayload,
  getSharerKeyIdForRecipientParentAccess,
  getCommentThreadMessageId,
  isShareDelivery,
} from '@/crypto/manifestShare.ts';
import { listStoredUsers } from '@/services/db/storedPublicKeys.ts';

function labelForKeyId(
  keyId: string | null,
  usernameByKeyId: Map<string, string>,
): string {
  if (!keyId) {
    return 'Unknown sender';
  }
  return usernameByKeyId.get(keyId) ?? `${keyId.slice(0, 12)}...`;
}

/** Resolve display names for message senders (username or truncated keyId). */
export function useInboxSenderLabels(
  messages: StoredMessage[],
  recipientKeyId: string | null,
): Record<string, string> {
  const [labelsById, setLabelsById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    let cancelled = false;

    async function resolveLabels() {
      const users = await listStoredUsers();
      const usernameByKeyId = new Map(
        users.map((user) => [user.keyId, user.username]),
      );

      const entries = await Promise.all(
        messages.map(async (message) => {
          if (isShareDelivery(message)) {
            const [authorKeyId, sharerKeyId] = await Promise.all([
              getStoredParentSenderKeyId(message.parentMessageId),
              getSharerKeyIdFromSharePayload(message.payload),
            ]);
            const authorLabel = labelForKeyId(authorKeyId, usernameByKeyId);
            const sharerLabel = labelForKeyId(sharerKeyId, usernameByKeyId);
            return [
              message.id,
              `${authorLabel} · shared by ${sharerLabel}`,
            ] as const;
          }

          const threadId = getCommentThreadMessageId(message);
          const authorKeyId = await getSenderKeyIdFromPayload(message.payload);
          const authorLabel = labelForKeyId(authorKeyId, usernameByKeyId);

          if (recipientKeyId) {
            const sharerKeyId = await getSharerKeyIdForRecipientParentAccess(
              threadId,
              recipientKeyId,
            );
            if (sharerKeyId) {
              const sharerLabel = labelForKeyId(sharerKeyId, usernameByKeyId);
              return [
                message.id,
                `${authorLabel} · shared by ${sharerLabel}`,
              ] as const;
            }
          }

          return [message.id, authorLabel] as const;
        }),
      );

      if (!cancelled) {
        setLabelsById(Object.fromEntries(entries));
      }
    }

    resolveLabels();

    return () => {
      cancelled = true;
    };
  }, [messages, recipientKeyId]);

  return messages.length === 0 ? {} : labelsById;
}

async function getStoredParentSenderKeyId(
  parentMessageId: string,
): Promise<string | null> {
  const parent = await getStoredMessageById(parentMessageId);
  if (!parent) {
    return null;
  }
  return getSenderKeyIdFromPayload(parent.payload);
}
