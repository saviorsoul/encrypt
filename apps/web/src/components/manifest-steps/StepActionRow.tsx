import React from 'react';
import Box from '@mui/material/Box';

const stepButtonBaseSx = {
  p: 1,
  gap: 0.5,
  lineHeight: 1.2,
  whiteSpace: 'normal',
  textAlign: 'center',
  '& .MuiButton-startIcon': {
    margin: 0,
  },
} as const;

export const stepButtonSx = {
  ...stepButtonBaseSx,
  width: '8rem',
  height: '8rem',
  minWidth: '8rem',
  minHeight: '8rem',
  flexDirection: 'column',
} as const;

type StepActionRowProps = {
  children: React.ReactNode;
  content?: React.ReactNode;
};

export function StepActionRow({ children, content }: StepActionRowProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        my: 2,
      }}
    >
      {content != null && (
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            display: { md: 'flex' },
            '& > .MuiAlert-root': {
              flex: { md: 1 },
              m: 0,
              display: { md: 'flex' },
              alignItems: { md: 'center' },
            },
          }}
        >
          {content}
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          alignSelf: { md: 'flex-start' },
          flexShrink: 0,
          width: { xs: '100%', md: 'auto' },
          ml: { md: 'auto' },
          '& > .MuiButton-root': {
            ...stepButtonBaseSx,
            flex: { xs: 1, md: '0 0 auto' },
            width: { xs: '100%', md: '8rem' },
            minWidth: { md: '8rem' },
            height: { md: '8rem' },
            minHeight: { md: '8rem' },
            flexDirection: { md: 'column' },
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
