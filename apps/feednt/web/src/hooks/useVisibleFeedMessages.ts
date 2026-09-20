import { useEffect, useMemo, useRef, useState } from 'react';
import type { StoredMessage } from '@encrypt/core/feed/types';
import type { useBackendDecrypt } from '@feednt/hooks/useBackendDecrypt.ts';
import { warmSenderIdentitiesForMessages } from '@feednt/lib/identityFromPayload.ts';

type DecryptFeedContext = Parameters<
  ReturnType<typeof useBackendDecrypt>['decryptDeliveries']
>[1];

type UseVisibleFeedMessagesOptions = {
  messages: StoredMessage[];
  feedLoading: boolean;
  automateDecryption: boolean;
  decryptDeliveries: ReturnType<typeof useBackendDecrypt>['decryptDeliveries'];
  feedContext: DecryptFeedContext;
};

export function useVisibleFeedMessages({
  messages,
  feedLoading,
  automateDecryption,
  decryptDeliveries,
  feedContext,
}: UseVisibleFeedMessagesOptions) {
  const [visibleMessages, setVisibleMessages] = useState<StoredMessage[]>([]);
  const [preparing, setPreparing] = useState(false);
  const feedContextRef = useRef(feedContext);
  const lastProcessedMessagesSyncKeyRef = useRef<string | null>(null);

  const messagesSyncKey = useMemo(
    () =>
      messages
        .map((message) => `${message.id}:${message.lastCommentAt ?? ''}`)
        .join('\0'),
    [messages],
  );

  const visibleMessageIds = useMemo(
    () => new Set(visibleMessages.map((message) => message.id)),
    [visibleMessages],
  );

  const pendingPreparation = useMemo(() => {
    if (feedLoading || messages.length === 0) {
      return false;
    }

    return messages.some((message) => !visibleMessageIds.has(message.id));
  }, [feedLoading, messages, visibleMessageIds]);

  useEffect(() => {
    feedContextRef.current = feedContext;
  }, [feedContext]);

  useEffect(() => {
    if (feedLoading) {
      return;
    }

    if (messages.length === 0) {
      if (lastProcessedMessagesSyncKeyRef.current === messagesSyncKey) {
        return;
      }
      lastProcessedMessagesSyncKeyRef.current = messagesSyncKey;
      setVisibleMessages((current) => (current.length === 0 ? current : []));
      setPreparing(false);
      return;
    }

    const visibleIds = new Set(visibleMessages.map((message) => message.id));
    const hasNewMessageIds = messages.some(
      (message) => !visibleIds.has(message.id),
    );

    if (!hasNewMessageIds) {
      if (lastProcessedMessagesSyncKeyRef.current === messagesSyncKey) {
        return;
      }

      lastProcessedMessagesSyncKeyRef.current = messagesSyncKey;
      setVisibleMessages(messages);
      setPreparing(false);
      return;
    }

    let cancelled = false;
    setPreparing(true);

    const newMessages = messages.filter(
      (message) => !visibleIds.has(message.id),
    );

    void (async () => {
      await warmSenderIdentitiesForMessages(newMessages);
      if (cancelled) {
        return;
      }
      if (automateDecryption) {
        await decryptDeliveries(messages, feedContextRef.current);
      }
      if (!cancelled) {
        setVisibleMessages(messages);
        lastProcessedMessagesSyncKeyRef.current = messagesSyncKey;
      }
    })().finally(() => {
      if (!cancelled) {
        setPreparing(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    automateDecryption,
    decryptDeliveries,
    feedLoading,
    messages,
    messagesSyncKey,
    visibleMessages,
  ]);

  return {
    visibleMessages,
    preparing: preparing || pendingPreparation,
  };
}
