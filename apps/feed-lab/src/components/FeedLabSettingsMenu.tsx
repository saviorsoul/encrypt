import React, { useCallback, useState } from 'react';
import {
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Switch,
  Tooltip,
} from '@mui/material';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { formatAuthPublicKeyWire } from '@encrypt/core/crypto/authProof';
import { CopiedToClipboardSnackbar } from '@/components/CopiedToClipboardSnackbar.tsx';
import { useCopiedToClipboardSnackbar } from '@/hooks/useCopiedToClipboardSnackbar.tsx';
import { useFeedLabSettings } from '@lab/providers/FeedLabSettingsProvider.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';

function shortenMiddle(text: string, head = 12, tail = 8): string {
  if (text.length <= head + tail + 3) {
    return text;
  }
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

const menuItemSx = {
  fontSize: '0.8125rem',
  py: 0.75,
  minHeight: 36,
} as const;

const listItemTextProps = {
  slotProps: {
    primary: { variant: 'body2' as const, sx: { fontSize: '0.8125rem' } },
    secondary: { variant: 'caption' as const, sx: { fontSize: '0.75rem' } },
  },
};

export function FeedLabSettingsMenu() {
  const { keys } = useFeedLabSession();
  const {
    requestsApprovalDialog,
    setRequestsApprovalDialog,
    colorMode,
    setColorMode,
  } = useFeedLabSettings();
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = anchorEl !== null;

  const publicKeyWire = keys.publicKey
    ? formatAuthPublicKeyWire(keys.publicKey)
    : null;

  const handleOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleCopyKeyId = useCallback(() => {
    if (!keys.keyId) {
      return;
    }
    void copyAndNotify(keys.keyId);
    handleClose();
  }, [copyAndNotify, handleClose, keys.keyId]);

  const handleCopyPublicKey = useCallback(() => {
    if (!publicKeyWire) {
      return;
    }
    void copyAndNotify(publicKeyWire);
    handleClose();
  }, [copyAndNotify, handleClose, publicKeyWire]);

  const handleLogout = useCallback(() => {
    handleClose();
    keys.clearSession();
  }, [handleClose, keys]);

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
          size="small"
          color="inherit"
          aria-label="Settings"
          aria-controls={open ? 'feed-lab-settings-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={handleOpen}
        >
          <SettingsOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        id="feed-lab-settings-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { minWidth: 260 },
          },
        }}
      >
        {keys.keyId ? (
          <>
            {keys.privateKeyFileName ? (
              <MenuItem disabled sx={{ ...menuItemSx, opacity: 1 }}>
                <ListItemText
                  primary="Private key file"
                  secondary={keys.privateKeyFileName}
                  {...listItemTextProps}
                />
              </MenuItem>
            ) : null}
            <MenuItem onClick={handleCopyKeyId} sx={menuItemSx}>
              <ListItemText
                primary="keyId"
                secondary={shortenMiddle(keys.keyId)}
                {...listItemTextProps}
              />
              <ListItemIcon sx={{ minWidth: 0, pl: 1 }}>
                <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
            </MenuItem>
            {publicKeyWire ? (
              <MenuItem onClick={handleCopyPublicKey} sx={menuItemSx}>
                <ListItemText
                  primary="publicKey"
                  secondary={shortenMiddle(publicKeyWire, 10, 10)}
                  {...listItemTextProps}
                />
                <ListItemIcon sx={{ minWidth: 0, pl: 1 }}>
                  <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
                </ListItemIcon>
              </MenuItem>
            ) : null}
            <MenuItem onClick={handleLogout} sx={menuItemSx}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <LogoutOutlinedIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText primary="Log out" {...listItemTextProps} />
            </MenuItem>
            <Divider />
          </>
        ) : null}
        <MenuItem
          onClick={toggleDarkMode}
          sx={{ ...menuItemSx, justifyContent: 'space-between', gap: 2 }}
        >
          Dark mode
          <Switch
            size="small"
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
          sx={{ ...menuItemSx, justifyContent: 'space-between', gap: 2 }}
        >
          Requests approval dialog
          <Switch
            size="small"
            edge="end"
            checked={requestsApprovalDialog}
            tabIndex={-1}
            disableRipple
            onClick={(event) => event.stopPropagation()}
            onChange={(_, checked) => setRequestsApprovalDialog(checked)}
          />
        </MenuItem>
      </Menu>

      <CopiedToClipboardSnackbar {...snackbarProps} />
    </>
  );
}
