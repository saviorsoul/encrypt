import React from 'react';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { STORAGE_PERSISTENCE_WARNING_MESSAGE } from '@/utils/storagePersistenceWarning.ts';

const tooltipSlotProps = {
  tooltip: { sx: { maxWidth: 320 } },
} as const;

export function StoragePersistenceWarningNavIcon() {
  const isTouchPrimary = useMediaQuery('(hover: none)');

  if (isTouchPrimary) {
    return (
      <Tooltip
        title={STORAGE_PERSISTENCE_WARNING_MESSAGE}
        describeChild
        arrow
        enterTouchDelay={0}
        leaveTouchDelay={5000}
        slotProps={tooltipSlotProps}
      >
        <IconButton
          size="small"
          color="warning"
          aria-label={STORAGE_PERSISTENCE_WARNING_MESSAGE}
        >
          <WarningAmberOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={STORAGE_PERSISTENCE_WARNING_MESSAGE}
      describeChild
      arrow
      slotProps={tooltipSlotProps}
    >
      <IconButton
        size="small"
        color="warning"
        aria-label={STORAGE_PERSISTENCE_WARNING_MESSAGE}
      >
        <WarningAmberOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
