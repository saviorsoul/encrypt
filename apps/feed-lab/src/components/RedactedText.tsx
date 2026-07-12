import { memo, useMemo } from 'react';
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
    <p
      style={{
        margin: 0,
        lineHeight: 1.85,
        fontSize: '0.875rem',
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
              marginBottom: 1,
              userSelect: 'none',
            }}
          />
          {index < bars.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
});
