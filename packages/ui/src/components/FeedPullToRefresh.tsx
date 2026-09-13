import { useFeedPullToRefresh } from '../hooks/useFeedPullToRefresh.ts';

export type FeedPullToRefreshProps = {
  enabled: boolean;
  disabled?: boolean;
  busy?: boolean;
  onRefresh: () => void | Promise<void>;
};

export function FeedPullToRefresh({
  enabled,
  disabled = false,
  busy = false,
  onRefresh,
}: FeedPullToRefreshProps) {
  useFeedPullToRefresh({
    enabled,
    disabled: disabled || busy,
    onRefresh,
  });

  return null;
}
