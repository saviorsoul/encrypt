import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import type { ReactNode } from 'react';

const ICON_SLOT_PX = 18;

export const feedActionButtonSx = {
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

export function FeedBusyButtonIcon() {
  return (
    <ButtonIconSlot>
      <CircularProgress
        size={ICON_SLOT_PX}
        color="inherit"
        thickness={4}
        sx={{ display: 'block' }}
      />
    </ButtonIconSlot>
  );
}

export type FeedRefreshButtonIconProps = {
  busy: boolean;
};

export function FeedRefreshButtonIcon({ busy }: FeedRefreshButtonIconProps) {
  return (
    <ButtonIconSlot>
      {busy ? (
        <CircularProgress
          size={ICON_SLOT_PX}
          color="inherit"
          thickness={4}
          sx={{ display: 'block' }}
        />
      ) : (
        <RefreshOutlinedIcon />
      )}
    </ButtonIconSlot>
  );
}
