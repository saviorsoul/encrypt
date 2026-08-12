import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import type { SxProps, Theme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import type { ReactNode } from 'react';

const ICON_SLOT_PX = 18;

export const feedActionButtonSx: SxProps<Theme> = {
  minHeight: 30.75,
  '& .MuiButton-startIcon': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 0,
  },
};

const iconSlotSx = {
  width: ICON_SLOT_PX,
  height: ICON_SLOT_PX,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  '& > svg': {
    fontSize: ICON_SLOT_PX,
  },
} as const;

export function ButtonIconSlot({ children }: { children: ReactNode }) {
  return (
    <Box component="span" aria-hidden sx={iconSlotSx}>
      {children}
    </Box>
  );
}

export type FeedRefreshButtonIconProps = {
  busy: boolean;
  success: boolean;
};

export function FeedRefreshButtonIcon({
  busy,
  success,
}: FeedRefreshButtonIconProps) {
  return (
    <ButtonIconSlot>
      {busy ? (
        <CircularProgress
          size={ICON_SLOT_PX}
          color="inherit"
          thickness={4}
          sx={{ display: 'block' }}
        />
      ) : success ? (
        <CheckIcon />
      ) : (
        <RefreshOutlinedIcon />
      )}
    </ButtonIconSlot>
  );
}
