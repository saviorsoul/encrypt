import { useEffect, useState } from 'react';
import {
  getSenderKeyIdFromPayload,
  getStoredMessageById,
  type StoredMessage,
} from '@/services/db/storedMessages.ts';
import {
  getSharerKeyIdFromSharePayload,
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
              message.parentMessageId
                ? getStoredParentSenderKeyId(message.parentMessageId)
                : Promise.resolve(null),
              getSharerKeyIdFromSharePayload(message.payload),
            ]);
            const authorLabel = labelForKeyId(authorKeyId, usernameByKeyId);
            const sharerLabel = labelForKeyId(sharerKeyId, usernameByKeyId);
            return [
              message.id,
              `${authorLabel} · shared by ${sharerLabel}`,
            ] as const;
          }

          const senderKeyId = await getSenderKeyIdFromPayload(message.payload);
          return [
            message.id,
            labelForKeyId(senderKeyId, usernameByKeyId),
          ] as const;
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
  }, [messages]);

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
