import { useEffect, useState } from 'react';
import { waitForMinDuration } from '../utils/waitForMinDuration.ts';

export const CREATE_MESSAGE_RECIPIENTS_LOADING_MIN_MS = 1000;

type EnsureFriendshipsLoaded = (options?: { force?: boolean }) => Promise<void>;

type RecipientsLoadingState = {
  loadingFriends: boolean;
  loadingRecipientKeys: boolean;
};

export function useCreateMessageRecipientsLoading(
  dialogOpen: boolean,
  ensureFriendshipsLoaded: EnsureFriendshipsLoaded,
  recipients: RecipientsLoadingState,
): RecipientsLoadingState {
  const [minLoading, setMinLoading] = useState(false);

  useEffect(() => {
    if (!dialogOpen) {
      setMinLoading(false);
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();
    setMinLoading(true);

    void (async () => {
      await ensureFriendshipsLoaded({ force: true });
      await waitForMinDuration(
        startedAt,
        CREATE_MESSAGE_RECIPIENTS_LOADING_MIN_MS,
      );
      if (!cancelled) {
        setMinLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dialogOpen, ensureFriendshipsLoaded]);

  const loading =
    minLoading || recipients.loadingFriends || recipients.loadingRecipientKeys;

  return {
    loadingFriends: loading,
    loadingRecipientKeys: loading,
  };
}
