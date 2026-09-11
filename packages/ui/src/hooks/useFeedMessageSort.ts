import { useCallback, useState } from 'react';
import type { FeedMessageSortMode } from '@encrypt/core/feed/types';
import { FEED_MESSAGE_SORT_MODE_LABELS } from '@encrypt/core/utils/feedMessageSort';

export function useFeedMessageSort() {
  const [sortMode, setSortModeState] =
    useState<FeedMessageSortMode>('shareTime');

  const setSortMode = useCallback((mode: FeedMessageSortMode) => {
    setSortModeState(mode);
  }, []);

  const sortModeLabel = FEED_MESSAGE_SORT_MODE_LABELS[sortMode];

  return {
    sortMode,
    setSortMode,
    sortModeLabel,
  };
}
