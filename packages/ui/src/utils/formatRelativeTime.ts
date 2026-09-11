export type FormatRelativeTimeOptions = {
  /** Show "<1 min ago" for anything under one minute instead of second precision. */
  omitSeconds?: boolean;
};

export function formatRelativeTime(
  timestamp: number,
  now = Date.now(),
  options: FormatRelativeTimeOptions = {},
): string {
  const seconds = Math.floor((now - timestamp) / 1000);

  if (seconds < 60) {
    if (options.omitSeconds) {
      return '<1 min ago';
    }
    return seconds <= 1 ? 'just now' : `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}
