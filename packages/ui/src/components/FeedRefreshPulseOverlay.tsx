import Box from '@mui/material/Box';

const FEED_REFRESH_PULSE = 'feedRefreshPulse';
const FEED_REFRESH_PULSE_MS = 480;

export type FeedRefreshPulseOverlayProps = {
  active: boolean;
};

export function FeedRefreshPulseOverlay({
  active,
}: FeedRefreshPulseOverlayProps) {
  if (!active) {
    return null;
  }

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        borderRadius: 1,
        bgcolor: 'background.paper',
        willChange: 'opacity',
        [`@keyframes ${FEED_REFRESH_PULSE}`]: {
          '0%': { opacity: 0 },
          '40%': { opacity: 0.5 },
          '100%': { opacity: 0 },
        },
        animation: `${FEED_REFRESH_PULSE} ${FEED_REFRESH_PULSE_MS}ms ease-out both`,
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
          display: 'none',
        },
      }}
    />
  );
}
