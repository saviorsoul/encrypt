import React, { useCallback, useState } from 'react';
import {
  IconButton,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import SortOutlinedIcon from '@mui/icons-material/SortOutlined';
import type { FeedMessageSortMode } from '@encrypt/core/feed/types';
import { FEED_MESSAGE_SORT_MODE_LABELS } from '@encrypt/core/utils/feedMessageSort';
import { TooltipIconWrap } from './TooltipIconWrap.tsx';

const SORT_MODES: FeedMessageSortMode[] = [
  'shareTime',
  'originalDate',
  'lastComment',
];

const menuItemSx = {
  fontSize: '0.8125rem',
  py: 0.75,
  minHeight: '36px !important',
} as const;

const listItemTextProps = {
  slotProps: {
    primary: { variant: 'body2' as const, sx: { fontSize: '0.8125rem' } },
  },
};

export type FeedMessageSortButtonProps = {
  sortMode: FeedMessageSortMode;
  onSortModeChange: (mode: FeedMessageSortMode) => void;
  disabled?: boolean;
};

export function FeedMessageSortButton({
  sortMode,
  onSortModeChange,
  disabled = false,
}: FeedMessageSortButtonProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = menuAnchor != null;
  const sortLabel = FEED_MESSAGE_SORT_MODE_LABELS[sortMode];

  const handleOpenMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setMenuAnchor(event.currentTarget);
    },
    [],
  );

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleSelectMode = useCallback(
    (mode: FeedMessageSortMode) => {
      onSortModeChange(mode);
      handleCloseMenu();
    },
    [handleCloseMenu, onSortModeChange],
  );

  return (
    <>
      <Tooltip title={`Sort by: ${sortLabel}`}>
        <TooltipIconWrap>
          <IconButton
            data-testid="feed-message-sort"
            size="small"
            disabled={disabled}
            onClick={handleOpenMenu}
            aria-label={`Sort by: ${sortLabel}`}
          >
            <SortOutlinedIcon fontSize="small" />
          </IconButton>
        </TooltipIconWrap>
      </Tooltip>
      <Menu
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          list: {
            sx: { py: 0 },
          },
        }}
      >
        <ListSubheader
          disableSticky
          sx={{
            fontSize: '0.8125rem',
            lineHeight: 2,
            minHeight: 'auto',
          }}
        >
          Sort by:
        </ListSubheader>
        {SORT_MODES.map((mode) => (
          <MenuItem
            key={mode}
            selected={mode === sortMode}
            onClick={() => handleSelectMode(mode)}
            sx={menuItemSx}
          >
            <ListItemText
              primary={FEED_MESSAGE_SORT_MODE_LABELS[mode]}
              {...listItemTextProps}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
