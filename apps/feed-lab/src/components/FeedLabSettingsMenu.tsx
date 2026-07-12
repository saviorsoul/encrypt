import React, { useCallback, useState } from 'react';
import { IconButton, Menu, MenuItem, Switch, Tooltip } from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useFeedLabSettings } from '@lab/providers/FeedLabSettingsProvider.tsx';

export function FeedLabSettingsMenu() {
  const {
    requestsApprovalDialog,
    setRequestsApprovalDialog,
    colorMode,
    setColorMode,
  } = useFeedLabSettings();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = anchorEl !== null;

  const handleOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const toggleRequestsApprovalDialog = useCallback(() => {
    setRequestsApprovalDialog(!requestsApprovalDialog);
  }, [requestsApprovalDialog, setRequestsApprovalDialog]);

  const toggleDarkMode = useCallback(() => {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark');
  }, [colorMode, setColorMode]);

  return (
    <>
      <Tooltip title="Settings">
        <IconButton
          color="inherit"
          aria-label="Settings"
          aria-controls={open ? 'feed-lab-settings-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={handleOpen}
        >
          <SettingsOutlinedIcon />
        </IconButton>
      </Tooltip>

      <Menu
        id="feed-lab-settings-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={toggleDarkMode}
          sx={{ justifyContent: 'space-between', gap: 2, minWidth: 280 }}
        >
          Dark mode
          <Switch
            edge="end"
            checked={colorMode === 'dark'}
            tabIndex={-1}
            disableRipple
            onClick={(event) => event.stopPropagation()}
            onChange={(_, checked) => setColorMode(checked ? 'dark' : 'light')}
          />
        </MenuItem>
        <MenuItem
          onClick={toggleRequestsApprovalDialog}
          sx={{ justifyContent: 'space-between', gap: 2, minWidth: 280 }}
        >
          Requests approval dialog
          <Switch
            edge="end"
            checked={requestsApprovalDialog}
            tabIndex={-1}
            disableRipple
            onClick={(event) => event.stopPropagation()}
            onChange={(_, checked) => setRequestsApprovalDialog(checked)}
          />
        </MenuItem>
      </Menu>
    </>
  );
}
