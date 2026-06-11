import { useEffect, useState } from 'react';
import {
  getSenderKeyIdFromPayload,
  type StoredMessage,
} from '@/crypto/storedMessages.ts';
import { listStoredUsers } from '@/crypto/storedPublicKeys.ts';

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
          const senderKeyId = await getSenderKeyIdFromPayload(message.payload);
          const label =
            (senderKeyId && usernameByKeyId.get(senderKeyId)) ||
            (senderKeyId ? `${senderKeyId.slice(0, 12)}…` : 'Unknown sender');
          return [message.id, label] as const;
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
