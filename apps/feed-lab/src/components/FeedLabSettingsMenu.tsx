import React, { useCallback, useState } from 'react';
import {
  Collapse,
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
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { formatAuthPublicKeyWire } from '@encrypt/core/crypto/authProof';
import { CopiedToClipboardSnackbar, TooltipIconWrap } from '@encrypt/ui';
import { ClearAccountDataDialog } from '@encrypt/ui/ClearAccountDataDialog';
import { openGdprPage } from '@encrypt/ui/gdprPageHref';
import { useCopiedToClipboardSnackbar } from '@encrypt/ui/useCopiedToClipboardSnackbar';
import { useNavigate } from 'react-router-dom';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import { useFeedLabSettings } from '@lab/providers/FeedLabSettingsProvider.tsx';
import { useFeedLabSession } from '@lab/providers/FeedLabSessionProvider.tsx';
import { clearFeedLabStoredUsers } from '@lab/services/db/storedUsers.ts';
import { clearSentInvitationsForInviter } from '@lab/services/db/sentInvitations.ts';

function shortenMiddle(text: string, head = 12, tail = 8): string {
  if (text.length <= head + tail + 3) {
    return text;
  }
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

const menuItemSx = {
  fontSize: '0.8125rem',
  py: 0.75,
  minHeight: '36px !important',
} as const;

const listItemTextProps = {
  slotProps: {
    primary: { variant: 'body2' as const, sx: { fontSize: '0.8125rem' } },
    secondary: { variant: 'caption' as const, sx: { fontSize: '0.75rem' } },
  },
};

export function FeedLabSettingsMenu() {
  const navigate = useNavigate();
  const api = useFeedApi();
  const { keys } = useFeedLabSession();
  const {
    automateDecryption,
    setAutomateDecryption,
    requestsApprovalDialog,
    setRequestsApprovalDialog,
    colorMode,
    setColorMode,
  } = useFeedLabSettings();
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [clearAccountOpen, setClearAccountOpen] = useState(false);
  const [clearAccountBusy, setClearAccountBusy] = useState(false);
  const [clearAccountError, setClearAccountError] = useState<string | null>(
    null,
  );
  const [personalDataOpen, setPersonalDataOpen] = useState(false);
  const open = anchorEl !== null;

  const publicKeyWire = keys.publicKey
    ? formatAuthPublicKeyWire(keys.publicKey)
    : null;

  const handleOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
    setPersonalDataOpen(false);
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
    navigate('/login', { replace: true });
  }, [handleClose, keys, navigate]);

  const handleOpenClearAccount = useCallback(() => {
    handleClose();
    setClearAccountError(null);
    setClearAccountOpen(true);
  }, [handleClose]);

  const handleClearAccount = useCallback(async () => {
    if (!keys.keyId || clearAccountBusy) {
      return;
    }
    setClearAccountBusy(true);
    setClearAccountError(null);
    try {
      await api.deleteAccount();
      clearFeedLabStoredUsers(keys.keyId);
      clearSentInvitationsForInviter(keys.keyId);
      setClearAccountOpen(false);
      keys.clearSession();
      navigate('/login', { replace: true });
    } catch (error) {
      setClearAccountError(
        error instanceof Error
          ? error.message
          : 'Could not clear account data.',
      );
    } finally {
      setClearAccountBusy(false);
    }
  }, [api, clearAccountBusy, keys, navigate]);

  const toggleAutomateDecryption = useCallback(() => {
    setAutomateDecryption(!automateDecryption);
  }, [automateDecryption, setAutomateDecryption]);

  const toggleRequestsApprovalDialog = useCallback(() => {
    setRequestsApprovalDialog(!requestsApprovalDialog);
  }, [requestsApprovalDialog, setRequestsApprovalDialog]);

  const toggleDarkMode = useCallback(() => {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark');
  }, [colorMode, setColorMode]);

  const handleOpenGdpr = useCallback(() => {
    handleClose();
    openGdprPage();
  }, [handleClose]);

  return (
    <>
      <Tooltip title="Settings">
        <TooltipIconWrap>
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
        </TooltipIconWrap>
      </Tooltip>

      <Menu
        id="feed-lab-settings-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transitionDuration={0}
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
            {keys.isSystemAppSession ? (
              <MenuItem disabled sx={{ ...menuItemSx, opacity: 1 }}>
                <ListItemText
                  primary="Signing via Encrypt app"
                  secondary="Private key stays in the system app"
                  {...listItemTextProps}
                />
              </MenuItem>
            ) : keys.privateKeyFileName ? (
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
              <ListItemText primary="Log out" {...listItemTextProps} />
              <ListItemIcon sx={{ minWidth: 0, pl: 1 }}>
                <LogoutOutlinedIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
            </MenuItem>
            <Divider />
          </>
        ) : null}
        <MenuItem
          onClick={() => setPersonalDataOpen((current) => !current)}
          sx={menuItemSx}
          aria-expanded={personalDataOpen}
        >
          <ListItemText primary="Personal data" {...listItemTextProps} />
          <ListItemIcon sx={{ minWidth: 0, pl: 1 }}>
            {personalDataOpen ? (
              <ExpandLessOutlinedIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMoreOutlinedIcon sx={{ fontSize: 16 }} />
            )}
          </ListItemIcon>
        </MenuItem>
        <Collapse in={personalDataOpen} timeout={0} unmountOnExit>
          <MenuItem onClick={handleOpenGdpr} sx={menuItemSx}>
            <ListItemText
              primary="Personal data notice"
              {...listItemTextProps}
            />
            <ListItemIcon sx={{ minWidth: 0, pl: 1 }}>
              <PolicyOutlinedIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
          </MenuItem>
          {keys.keyId ? (
            <MenuItem onClick={handleOpenClearAccount} sx={menuItemSx}>
              <ListItemText
                primary="Clear account data"
                {...listItemTextProps}
              />
              <ListItemIcon sx={{ minWidth: 0, pl: 1 }}>
                <DeleteOutlineOutlinedIcon
                  color="error"
                  sx={{ fontSize: 16 }}
                />
              </ListItemIcon>
            </MenuItem>
          ) : null}
        </Collapse>
        <Divider />
        <MenuItem
          onClick={toggleAutomateDecryption}
          disabled={keys.isSystemAppSession}
          sx={{ ...menuItemSx, justifyContent: 'space-between', gap: 2 }}
        >
          Automate decryption
          <Switch
            size="small"
            edge="end"
            checked={keys.isSystemAppSession ? false : automateDecryption}
            disabled={keys.isSystemAppSession}
            tabIndex={-1}
            disableRipple
            onClick={(event) => event.stopPropagation()}
            onChange={(_, checked) => setAutomateDecryption(checked)}
          />
        </MenuItem>
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
          disabled={keys.isSystemAppSession}
          sx={{ ...menuItemSx, justifyContent: 'space-between', gap: 2 }}
        >
          Requests approval dialog
          <Switch
            size="small"
            edge="end"
            checked={requestsApprovalDialog}
            disabled={keys.isSystemAppSession}
            tabIndex={-1}
            disableRipple
            onClick={(event) => event.stopPropagation()}
            onChange={(_, checked) => setRequestsApprovalDialog(checked)}
          />
        </MenuItem>
      </Menu>

      <CopiedToClipboardSnackbar {...snackbarProps} />
      <ClearAccountDataDialog
        open={clearAccountOpen}
        busy={clearAccountBusy}
        error={clearAccountError}
        onClose={() => setClearAccountOpen(false)}
        onConfirm={() => void handleClearAccount()}
        onClearError={() => setClearAccountError(null)}
      />
    </>
  );
}
