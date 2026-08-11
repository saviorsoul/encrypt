import { useCallback, useState, type MouseEvent } from 'react';
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
import { CopiedToClipboardSnackbar } from '@encrypt/ui/CopiedToClipboardSnackbar';
import { useCopiedToClipboardSnackbar } from '@encrypt/ui/useCopiedToClipboardSnackbar';
import { useNavigate } from 'react-router-dom';
import { useFeedntSettings } from '@feednt/providers/FeedntSettingsProvider.tsx';
import { useFeedntSession } from '@feednt/providers/FeedntSessionProvider.tsx';

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

export function FeedntSettingsMenu() {
  const navigate = useNavigate();
  const { session, signOut } = useFeedntSession();
  const { colorMode, setColorMode } = useFeedntSettings();
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = anchorEl !== null;

  const publicKeyWire = session?.publicKey
    ? formatAuthPublicKeyWire(session.publicKey)
    : null;

  const handleOpen = useCallback((event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleCopyKeyId = useCallback(() => {
    if (!session?.keyId) {
      return;
    }
    void copyAndNotify(session.keyId);
    handleClose();
  }, [copyAndNotify, handleClose, session?.keyId]);

  const handleCopyPublicKey = useCallback(() => {
    if (!publicKeyWire) {
      return;
    }
    void copyAndNotify(publicKeyWire);
    handleClose();
  }, [copyAndNotify, handleClose, publicKeyWire]);

  const handleLogout = useCallback(() => {
    handleClose();
    signOut();
    navigate('/login', { replace: true });
  }, [handleClose, navigate, signOut]);

  return (
    <>
      <Tooltip title="Settings">
        <IconButton
          size="small"
          color="inherit"
          aria-label="Settings"
          aria-controls={open ? 'feednt-settings-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={handleOpen}
        >
          <SettingsOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        id="feednt-settings-menu"
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
        {session?.keyId ? (
          <>
            <MenuItem disabled sx={{ ...menuItemSx, opacity: 1 }}>
              <ListItemText
                primary="Private key"
                secondary="Stored in secure device storage"
                {...listItemTextProps}
              />
            </MenuItem>
            <MenuItem onClick={handleCopyKeyId} sx={menuItemSx}>
              <ListItemText
                primary="keyId"
                secondary={shortenMiddle(session.keyId)}
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
          onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}
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
      </Menu>

      <CopiedToClipboardSnackbar {...snackbarProps} />
    </>
  );
}
