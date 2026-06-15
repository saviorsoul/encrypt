import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import useMediaQuery from '@mui/material/useMediaQuery';

const MESSAGE_POPOVER_CLOSE_DELAY_MS = 150;
const MESSAGE_BUBBLE_SELECTOR = '[data-one-to-one-message-bubble]';

function focusAdjacentMessageBubble(
  currentBubble: HTMLElement,
  direction: 'next' | 'prev',
): boolean {
  const bubbles = Array.from(
    document.querySelectorAll<HTMLElement>(MESSAGE_BUBBLE_SELECTOR),
  );
  const index = bubbles.indexOf(currentBubble);
  if (index === -1) {
    return false;
  }

  const target = bubbles[direction === 'next' ? index + 1 : index - 1] ?? null;
  if (!target) {
    return false;
  }

  target.focus();
  return true;
}

export type OneToOneMessageBubblePopoverProps = {
  messageId: string;
  authorLabel: string;
  alignEnd: boolean;
  highlighted?: boolean;
  actions: React.ReactNode;
  children: React.ReactNode;
};

export function OneToOneMessageBubblePopover({
  messageId,
  authorLabel,
  alignEnd,
  highlighted = false,
  actions,
  children,
}: OneToOneMessageBubblePopoverProps) {
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(
    null,
  );
  const actionsRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const touchDevice = useMediaQuery('(hover: none)');
  const popoverOpen = popoverAnchorEl !== null;
  const popoverId = `one-to-one-message-popover-${messageId}`;

  const isFocusWithinMessageSurface = useCallback(
    (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return false;
      }
      if (
        popoverAnchorEl !== null &&
        (popoverAnchorEl === target || popoverAnchorEl.contains(target))
      ) {
        return true;
      }
      return target.closest(`#${CSS.escape(popoverId)}`) !== null;
    },
    [popoverAnchorEl, popoverId],
  );

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPopover = useCallback(
    (element: HTMLElement) => {
      clearCloseTimer();
      setPopoverAnchorEl(element);
    },
    [clearCloseTimer],
  );

  const closePopover = useCallback(() => {
    clearCloseTimer();
    setPopoverAnchorEl(null);
  }, [clearCloseTimer]);

  const scheduleClosePopover = useCallback(() => {
    if (touchDevice) {
      return;
    }
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setPopoverAnchorEl(null);
    }, MESSAGE_POPOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer, touchDevice]);

  const focusFirstAction = useCallback(() => {
    const firstAction = actionsRef.current?.querySelector(
      'button:not(:disabled)',
    );
    if (firstAction instanceof HTMLElement) {
      firstAction.focus();
    }
  }, []);

  const handleBubbleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!touchDevice) {
        return;
      }
      if (popoverOpen) {
        closePopover();
        return;
      }
      openPopover(event.currentTarget);
    },
    [closePopover, openPopover, popoverOpen, touchDevice],
  );

  const handleBubbleFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      if (touchDevice) {
        return;
      }
      openPopover(event.currentTarget);
    },
    [openPopover, touchDevice],
  );

  const handleBubbleBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      if (isFocusWithinMessageSurface(event.relatedTarget)) {
        return;
      }
      closePopover();
    },
    [closePopover, isFocusWithinMessageSurface],
  );

  const handleBubbleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopover();
        return;
      }

      if (event.key === 'Tab' && event.shiftKey) {
        if (focusAdjacentMessageBubble(event.currentTarget, 'prev')) {
          event.preventDefault();
        }
        return;
      }

      if (event.key === 'Tab' && !event.shiftKey && popoverOpen) {
        const firstAction = actionsRef.current?.querySelector(
          'button:not(:disabled)',
        );
        if (firstAction instanceof HTMLElement) {
          event.preventDefault();
          firstAction.focus();
        }
        return;
      }

      if (
        touchDevice &&
        (event.key === 'Enter' || event.key === ' ') &&
        !popoverOpen
      ) {
        event.preventDefault();
        openPopover(event.currentTarget);
        return;
      }

      if (
        touchDevice &&
        (event.key === 'Enter' || event.key === ' ') &&
        popoverOpen
      ) {
        event.preventDefault();
        focusFirstAction();
      }
    },
    [closePopover, focusFirstAction, openPopover, popoverOpen, touchDevice],
  );

  const handleActionsKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopover();
        popoverAnchorEl?.focus();
        return;
      }

      if (event.key === 'Tab' && event.shiftKey) {
        const firstAction = actionsRef.current?.querySelector(
          'button:not(:disabled)',
        );
        if (firstAction === event.target && popoverAnchorEl) {
          event.preventDefault();
          popoverAnchorEl.focus();
          return;
        }
      }

      if (event.key === 'Tab' && !event.shiftKey && popoverAnchorEl) {
        const actionButtons = actionsRef.current?.querySelectorAll(
          'button:not(:disabled)',
        );
        const lastAction = actionButtons?.[actionButtons.length - 1];
        if (lastAction === event.target) {
          if (focusAdjacentMessageBubble(popoverAnchorEl, 'next')) {
            event.preventDefault();
          }
        }
      }
    },
    [closePopover, popoverAnchorEl],
  );

  const handleActionsBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      if (isFocusWithinMessageSurface(event.relatedTarget)) {
        return;
      }
      closePopover();
    },
    [closePopover, isFocusWithinMessageSurface],
  );

  const handleBubbleMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      openPopover(event.currentTarget);
    },
    [openPopover],
  );

  return (
    <>
      <Box
        role="button"
        tabIndex={0}
        data-one-to-one-message-bubble=""
        aria-haspopup="true"
        aria-expanded={popoverOpen}
        aria-label={`Message from ${authorLabel}`}
        onClick={handleBubbleClick}
        onFocus={handleBubbleFocus}
        onBlur={handleBubbleBlur}
        onKeyDown={handleBubbleKeyDown}
        onMouseEnter={touchDevice ? undefined : handleBubbleMouseEnter}
        onMouseLeave={touchDevice ? undefined : scheduleClosePopover}
        sx={{
          px: 1.75,
          py: 1.25,
          borderRadius: 2.5,
          bgcolor: alignEnd ? 'primary.main' : 'grey.300',
          color: 'primary.contrastText',
          boxShadow: highlighted ? 6 : 1,
          cursor: touchDevice ? 'pointer' : 'default',
          transition: 'box-shadow 0.2s ease',
          outline: highlighted ? '2px solid' : 'none',
          outlineColor: 'warning.main',
          outlineOffset: 2,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: highlighted ? 'warning.main' : 'primary.light',
            outlineOffset: 2,
          },
        }}
      >
        {children}
      </Box>
      <Popover
        open={popoverOpen}
        anchorEl={popoverAnchorEl}
        onClose={closePopover}
        hideBackdrop
        disableScrollLock
        anchorOrigin={{
          vertical: 'top',
          horizontal: alignEnd ? 'right' : 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: alignEnd ? 'right' : 'left',
        }}
        marginThreshold={8}
        disableRestoreFocus
        disableAutoFocus
        disableEnforceFocus
        slotProps={{
          root: {
            sx: {
              zIndex: (theme) => theme.zIndex.tooltip,
              pointerEvents: 'none',
            },
          },
          paper: {
            id: popoverId,
            onMouseEnter: touchDevice ? undefined : clearCloseTimer,
            onMouseLeave: touchDevice ? undefined : scheduleClosePopover,
            sx: {
              pointerEvents: 'auto',
              px: 1.25,
              py: 1,
              bgcolor: 'common.black',
              color: 'common.white',
            },
          },
        }}
      >
        <Box
          ref={actionsRef}
          onKeyDown={handleActionsKeyDown}
          onBlur={handleActionsBlur}
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
        </Box>
      </Popover>
    </>
  );
}
