import React from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useSessionPrivateKeyPreference } from '@/components/providers/SessionPrivateKeyProvider.tsx';

const TOOLTIP =
  'Keep your private key in memory. When enabled, your private key is kept as non-extractable way for this tab so you do not need to select the file each time. Refreshing the app clears the keys.';

const tooltipSlotProps = {
  tooltip: { sx: { maxWidth: 320 } },
} as const;

export function SessionPrivateKeyNavSwitch() {
  const { storageEnabled, setStorageEnabled } =
    useSessionPrivateKeyPreference();
  const isTouchPrimary = useMediaQuery('(hover: none)');

  const switchControl = (
    <Switch
      size="small"
      checked={storageEnabled}
      onChange={(_event, checked) => setStorageEnabled(checked)}
      slotProps={{
        input: {
          'aria-label': 'Allow private key to be cached in memory for this tab',
        },
      }}
    />
  );

  if (isTouchPrimary) {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        {switchControl}
        <Tooltip
          title={TOOLTIP}
          describeChild
          arrow
          enterTouchDelay={0}
          leaveTouchDelay={5000}
          slotProps={tooltipSlotProps}
        >
          <IconButton
            size="small"
            color="inherit"
            aria-label="About private key caching"
            sx={{ p: 0.25, ml: -0.25 }}
          >
            <InfoOutlinedIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Tooltip title={TOOLTIP} describeChild arrow slotProps={tooltipSlotProps}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {switchControl}
      </span>
    </Tooltip>
  );
}
