import React from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

type FeedntTextProps = {
  sx?: SxProps<Theme>;
};

export function FeedntText({ sx }: FeedntTextProps) {
  return (
    <Box
      component="span"
      sx={[
        (theme) => ({
          fontFamily: theme.feedLab.brandFontFamily,
          fontWeight: 700,
          color: theme.feedLab.brand,
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      Feedn't
    </Box>
  );
}
