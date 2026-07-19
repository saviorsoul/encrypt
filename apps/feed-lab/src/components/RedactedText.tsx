import { memo, useMemo } from 'react';
import { Box } from '@mui/material';
import { redactedBarsFromSeed } from '@lab/lib/redactedPlaceholder.ts';

const BAR_HEIGHT_PX = 14;

type RedactedTextProps = {
  seed: string;
  /** Caps preview length when the estimated plaintext is longer. */
  maxPreviewWords?: number;
};

export const RedactedText = memo(function RedactedText({
  seed,
  maxPreviewWords,
}: RedactedTextProps) {
  const bars = useMemo(
    () => redactedBarsFromSeed(seed, maxPreviewWords),
    [seed, maxPreviewWords],
  );

  return (
    <Box
      component="p"
      sx={{
        m: 0,
        fontSize: (theme) => theme.typography.body2.fontSize,
        lineHeight: (theme) => theme.typography.body2.lineHeight,
      }}
    >
      {bars.map((bar, index) => (
        <span key={index}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              backgroundColor: bar.color,
              color: 'transparent',
              borderRadius: 1,
              minWidth: bar.widthPx,
              height: BAR_HEIGHT_PX,
              verticalAlign: 'middle',
              userSelect: 'none',
            }}
          />
          {index < bars.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Box>
  );
});
