import {
  getCommentThreadMessageId,
  isShareDelivery,
} from '../crypto/manifestShare.ts';
import type { StoredFeedDelivery, StoredMessage } from '../feed/types.ts';

function pickCanonicalFeedMessage(
  threadMessages: StoredFeedDelivery[],
): StoredMessage | null {
  return threadMessages.find((message) => !isShareDelivery(message)) ?? null;
}

/**
 * One feed row per parent thread: the original post only. Share deliveries are
 * grouped under their parent and never shown as inbox rows.
 */
export function filterFeedInboxMessages(
  messages: StoredFeedDelivery[],
): StoredMessage[] {
  const threads = new Map<string, StoredFeedDelivery[]>();

  for (const message of messages) {
    const threadId = getCommentThreadMessageId(message);
    const group = threads.get(threadId) ?? [];
    group.push(message);
    threads.set(threadId, group);
  }

  const canonical = [...threads.values()]
    .map(pickCanonicalFeedMessage)
    .filter((message): message is StoredMessage => message !== null);

  return canonical.sort((a, b) => b.createdAt - a.createdAt);
}
