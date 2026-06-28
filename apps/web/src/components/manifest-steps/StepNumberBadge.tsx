import React from 'react';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { ManifestCryptoFlow } from '@/components/manifest-steps/stepLayout.ts';

const numberStyleByFlow: Record<
  ManifestCryptoFlow,
  {
    borderColor: string;
    backgroundColor: (theme: Theme) => string;
    color: string;
  }
> = {
  encrypt: {
    borderColor: 'success.main',
    backgroundColor: (theme) => alpha(theme.palette.success.main, 0.14),
    color: 'success.dark',
  },
  decrypt: {
    borderColor: 'primary.main',
    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.14),
    color: 'primary.dark',
  },
};

type StepNumberBadgeProps = {
  number: number;
  flow: ManifestCryptoFlow;
};

export function StepNumberBadge({ number, flow }: StepNumberBadgeProps) {
  const style = numberStyleByFlow[flow];

  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: 1,
        borderColor: style.borderColor,
        bgcolor: style.backgroundColor,
        color: style.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        typography: 'body2',
        fontWeight: 500,
        lineHeight: 1,
      }}
    >
      {number}
    </Box>
  );
}
