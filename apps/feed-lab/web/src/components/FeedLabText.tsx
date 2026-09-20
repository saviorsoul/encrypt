import { Box, type SxProps, type Theme } from '@mui/material';

type FeedLabTextProps = {
  sx?: SxProps<Theme>;
};

export function FeedLabText({ sx }: FeedLabTextProps) {
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
      Feed Lab
    </Box>
  );
}
