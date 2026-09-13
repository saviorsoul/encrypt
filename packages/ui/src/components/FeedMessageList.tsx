import { memo, type ReactNode } from 'react';
import type { StoredMessage } from '@encrypt/core/feed/types';
import { FeedMessageEnter } from './FeedMessageEnter.tsx';

export type FeedMessageListProps = {
  messages: readonly StoredMessage[];
  loadedMoreMessageIds: ReadonlySet<string>;
  visibleMessageIds: readonly string[];
  shouldAnimateEntry: (messageId: string) => boolean;
  getStaggerIndex: (
    messageId: string,
    visibleMessageIds: readonly string[],
  ) => number;
  onAnimationDone: (messageId: string) => void;
  renderMessage: (message: StoredMessage) => ReactNode;
};

function FeedMessageListInner({
  messages,
  loadedMoreMessageIds,
  visibleMessageIds,
  shouldAnimateEntry,
  getStaggerIndex,
  onAnimationDone,
  renderMessage,
}: FeedMessageListProps) {
  return (
    <>
      {messages.map((message) => (
        <FeedMessageEnter
          key={message.id}
          messageId={message.id}
          animateEntry={
            shouldAnimateEntry(message.id) &&
            !loadedMoreMessageIds.has(message.id)
          }
          staggerIndex={getStaggerIndex(message.id, visibleMessageIds)}
          onAnimationDone={onAnimationDone}
        >
          {renderMessage(message)}
        </FeedMessageEnter>
      ))}
    </>
  );
}

/** Memoized feed rows so unrelated FeedPage state (loading, dialogs) skips the list. */
export const FeedMessageList = memo(FeedMessageListInner);
