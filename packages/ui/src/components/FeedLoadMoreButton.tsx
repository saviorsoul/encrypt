import Button from '@mui/material/Button';
import type { SxProps, Theme } from '@mui/material/styles';
import { useCallback, useState } from 'react';
import { feedActionButtonSx } from './FeedRefreshButtonIcon.tsx';

export type FeedLoadMoreButtonProps = {
  busy?: boolean;
  onLoadMore: () => Promise<void>;
  sx?: SxProps<Theme>;
};

export function FeedLoadMoreButton({
  busy: externalBusy = false,
  onLoadMore,
  sx,
}: FeedLoadMoreButtonProps) {
  const [clickPending, setClickPending] = useState(false);
  const busy = clickPending || externalBusy;

  const handleClick = useCallback(() => {
    setClickPending(true);
    void onLoadMore().finally(() => {
      setClickPending(false);
    });
  }, [onLoadMore]);

  return (
    <Button
      variant="outlined"
      sx={[feedActionButtonSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      disabled={busy}
      onClick={handleClick}
    >
      {busy ? 'Loading...' : 'Load more'}
    </Button>
  );
}
