import React from 'react';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useProtocolHandler } from '@/components/providers/ProtocolHandlerProvider.tsx';
import { PROTOCOL_HANDLER_WARNING_MESSAGE } from '@/utils/protocolHandlerWarning.ts';

const tooltipSlotProps = {
  tooltip: { sx: { maxWidth: 320 } },
} as const;

export function ProtocolHandlerWarningNavIcon() {
  const { restoring, restoreDefaultHandler } = useProtocolHandler();
  const isTouchPrimary = useMediaQuery('(hover: none)');

  const button = (
    <IconButton
      size="small"
      color="warning"
      aria-label={PROTOCOL_HANDLER_WARNING_MESSAGE}
      disabled={restoring}
      onClick={() => {
        void restoreDefaultHandler();
      }}
    >
      <LinkOffOutlinedIcon fontSize="small" />
    </IconButton>
  );

  if (isTouchPrimary) {
    return (
      <Tooltip
        title={PROTOCOL_HANDLER_WARNING_MESSAGE}
        describeChild
        arrow
        enterTouchDelay={0}
        leaveTouchDelay={5000}
        slotProps={tooltipSlotProps}
      >
        {button}
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={PROTOCOL_HANDLER_WARNING_MESSAGE}
      describeChild
      arrow
      slotProps={tooltipSlotProps}
    >
      {button}
    </Tooltip>
  );
}
