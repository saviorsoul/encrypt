import React from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';

const GRID_TEMPLATES = {
  3: { xs: '1fr', md: '1fr auto 1fr' },
  5: { xs: '1fr', md: '1fr auto 1fr auto 1fr' },
} as const;

type StepExampleGridProps = {
  children: React.ReactNode;
  columns?: keyof typeof GRID_TEMPLATES;
  sx?: SxProps<Theme>;
};

export function StepExampleGrid({
  children,
  columns = 5,
  sx,
}: StepExampleGridProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: GRID_TEMPLATES[columns],
        gap: 1,
        alignItems: 'center',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
