import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import {
  formatEcPublicKeyText,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/ecPublicKey';
import { prettifyJsonText } from '@encrypt/core/utils/prettifyJsonText';
import { CopiedToClipboardSnackbar } from './CopiedToClipboardSnackbar.tsx';
import { useCopiedToClipboardSnackbar } from '../hooks/useCopiedToClipboardSnackbar.tsx';

export type IdentityDialogTarget = {
  keyId: string;
  publicKey: { x: string; y: string };
  label: string;
};

export type IdentityDialogProps = {
  open: boolean;
  identity: IdentityDialogTarget | null;
  isSelf: boolean;
  isFriend: boolean;
  existingUsername: string;
  existingUsernames: string[];
  friendshipsLoading: boolean;
  friendshipsError: string | null;
  busy: boolean;
  error: string | null;
  info: string | null;
  onClose: () => void;
  onExited?: () => void;
  onClearError: () => void;
  onCancelInFlight: () => void;
  onAddFriend: (name: string) => Promise<{ ok: boolean }>;
  onSaveName: (name: string) => Promise<{ ok: boolean; error?: string }>;
  messagesMuted?: boolean;
  sharesMuted?: boolean;
  onToggleMessagesMute?: () => Promise<{ ok: boolean; error?: string }>;
  onToggleSharesMute?: () => Promise<{ ok: boolean; error?: string }>;
};

type DeliveryMuteSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  ariaLabel: string;
  tooltip: string;
  icon: React.ReactNode;
};

function DeliveryMuteSwitch({
  checked,
  disabled = false,
  onToggle,
  ariaLabel,
  tooltip,
  icon,
}: DeliveryMuteSwitchProps) {
  return (
    <Tooltip title={tooltip}>
      <Stack
        component="span"
        direction="row"
        spacing={0.25}
        sx={{ alignItems: 'center', verticalAlign: 'middle' }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            color: checked ? 'error.main' : 'text.secondary',
          }}
        >
          {icon}
        </Box>
        <Switch
          size="small"
          checked={checked}
          onChange={() => onToggle()}
          disabled={disabled}
          color="error"
          slotProps={{
            input: {
              'aria-label': ariaLabel,
            },
          }}
        />
      </Stack>
    </Tooltip>
  );
}

function formatPublicKeyText(
  publicKey: { x: string; y: string },
  format: 'xy' | 'json',
): string {
  const jwk = slimEcPublicJwk({
    kty: 'EC',
    crv: 'P-256',
    x: publicKey.x,
    y: publicKey.y,
  });
  if (format === 'json') {
    return prettifyJsonText(JSON.stringify(jwk));
  }
  return formatEcPublicKeyText(jwk);
}

export function IdentityDialog({
  open,
  identity,
  isSelf,
  isFriend,
  existingUsername,
  existingUsernames,
  friendshipsLoading,
  friendshipsError,
  busy,
  error,
  info,
  onClose,
  onExited,
  onClearError,
  onCancelInFlight,
  onAddFriend,
  onSaveName,
  messagesMuted = false,
  sharesMuted = false,
  onToggleMessagesMute,
  onToggleSharesMute,
}: IdentityDialogProps) {
  const [format, setFormat] = useState<'xy' | 'json'>('xy');
  const [friendName, setFriendName] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [muteError, setMuteError] = useState<string | null>(null);
  const [messagesMutedOverride, setMessagesMutedOverride] = useState<
    boolean | null
  >(null);
  const [sharesMutedOverride, setSharesMutedOverride] = useState<
    boolean | null
  >(null);
  const muteToggleInflightRef = useRef({ messages: false, shares: false });
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevIdentityKeyId, setPrevIdentityKeyId] = useState(
    identity?.keyId ?? null,
  );
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFormat('xy');
      setFriendName(existingUsername);
      setSaveBusy(false);
      setSaveError(null);
      setMuteError(null);
      setMessagesMutedOverride(null);
      setSharesMutedOverride(null);
    } else {
      setSaveError(null);
      setMuteError(null);
      setMessagesMutedOverride(null);
      setSharesMutedOverride(null);
    }
  }

  if ((identity?.keyId ?? null) !== prevIdentityKeyId) {
    setPrevIdentityKeyId(identity?.keyId ?? null);
    if (open) {
      setFriendName(existingUsername);
      setSaveError(null);
      setMuteError(null);
      setMessagesMutedOverride(null);
      setSharesMutedOverride(null);
    }
  }

  useEffect(() => {
    if (
      messagesMutedOverride !== null &&
      messagesMuted === messagesMutedOverride
    ) {
      setMessagesMutedOverride(null);
    }
  }, [messagesMuted, messagesMutedOverride]);

  useEffect(() => {
    if (sharesMutedOverride !== null && sharesMuted === sharesMutedOverride) {
      setSharesMutedOverride(null);
    }
  }, [sharesMuted, sharesMutedOverride]);

  const publicKeyText = useMemo(() => {
    if (!identity) {
      return '';
    }
    return formatPublicKeyText(identity.publicKey, format);
  }, [format, identity]);

  const trimmedName = friendName.trim();
  const nameUnchanged =
    trimmedName.localeCompare(existingUsername, undefined, {
      sensitivity: 'accent',
    }) === 0;
  const nameExists =
    open &&
    trimmedName.length > 0 &&
    existingUsernames.some(
      (existing) =>
        existing.localeCompare(trimmedName, undefined, {
          sensitivity: 'accent',
        }) === 0,
    ) &&
    !nameUnchanged;
  const duplicateError = nameExists
    ? `"${trimmedName}" already exists. Choose a unique name.`
    : null;
  const displayMessagesMuted = messagesMutedOverride ?? messagesMuted;
  const displaySharesMuted = sharesMutedOverride ?? sharesMuted;
  const formBusy = busy || saveBusy;
  const canAddFriend =
    Boolean(identity) &&
    !isSelf &&
    !isFriend &&
    trimmedName.length > 0 &&
    !formBusy &&
    !nameExists &&
    !friendshipsLoading &&
    !friendshipsError &&
    !error;
  const canSaveName =
    Boolean(identity) &&
    !isSelf &&
    isFriend &&
    trimmedName.length > 0 &&
    !formBusy &&
    !nameExists &&
    !nameUnchanged;

  const handleClose = useCallback(() => {
    if (formBusy) {
      onCancelInFlight();
    }
    onClearError();
    setSaveError(null);
    onClose();
  }, [formBusy, onCancelInFlight, onClearError, onClose]);

  const handleAddFriend = useCallback(() => {
    if (!canAddFriend) {
      return;
    }
    void onAddFriend(trimmedName).then((result) => {
      if (result.ok) {
        onClose();
      }
    });
  }, [canAddFriend, onAddFriend, onClose, trimmedName]);

  const handleToggleMessagesMute = useCallback(() => {
    if (!onToggleMessagesMute || muteToggleInflightRef.current.messages) {
      return;
    }
    const next = !displayMessagesMuted;
    setMessagesMutedOverride(next);
    setMuteError(null);
    muteToggleInflightRef.current.messages = true;
    void onToggleMessagesMute().then((result) => {
      muteToggleInflightRef.current.messages = false;
      if (!result.ok) {
        setMessagesMutedOverride(null);
        setMuteError(result.error ?? 'Failed to update message mute.');
      }
    });
  }, [displayMessagesMuted, onToggleMessagesMute]);

  const handleToggleSharesMute = useCallback(() => {
    if (!onToggleSharesMute || muteToggleInflightRef.current.shares) {
      return;
    }
    const next = !displaySharesMuted;
    setSharesMutedOverride(next);
    setMuteError(null);
    muteToggleInflightRef.current.shares = true;
    void onToggleSharesMute().then((result) => {
      muteToggleInflightRef.current.shares = false;
      if (!result.ok) {
        setSharesMutedOverride(null);
        setMuteError(result.error ?? 'Failed to update share mute.');
      }
    });
  }, [displaySharesMuted, onToggleSharesMute]);

  const handleSaveName = useCallback(() => {
    if (!canSaveName) {
      return;
    }
    setSaveBusy(true);
    setSaveError(null);
    void onSaveName(trimmedName)
      .then((result) => {
        if (result.ok) {
          onClose();
          return;
        }
        setSaveError(result.error ?? 'Failed to save name.');
      })
      .finally(() => {
        setSaveBusy(false);
      });
  }, [canSaveName, onClose, onSaveName, trimmedName]);

  const title = identity
    ? identity.label === identity.keyId
      ? 'Identity'
      : identity.label
    : 'Identity';
  const showMuteControls =
    !isSelf &&
    isFriend &&
    (onToggleMessagesMute != null || onToggleSharesMute != null);

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        slotProps={{
          transition: {
            onExited,
          },
        }}
      >
        <DialogTitle
          title={title !== 'Identity' ? title : undefined}
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
              useFlexGap
            >
              <ToggleButtonGroup
                value={format}
                exclusive
                onChange={(_, next: 'xy' | 'json' | null) => {
                  if (next) {
                    setFormat(next);
                  }
                }}
                size="small"
              >
                <ToggleButton value="xy">x;y</ToggleButton>
                <ToggleButton value="json">JSON</ToggleButton>
              </ToggleButtonGroup>
              {showMuteControls ? (
                <Stack direction="row" spacing={1} useFlexGap>
                  {onToggleMessagesMute ? (
                    <DeliveryMuteSwitch
                      checked={displayMessagesMuted}
                      disabled={formBusy}
                      onToggle={handleToggleMessagesMute}
                      ariaLabel={
                        displayMessagesMuted
                          ? 'Unmute new messages from this friend'
                          : 'Mute new messages from this friend'
                      }
                      tooltip={
                        displayMessagesMuted
                          ? 'Unmute new messages from this friend'
                          : 'Mute new messages from this friend'
                      }
                      icon={<ChatBubbleOutlineOutlinedIcon fontSize="small" />}
                    />
                  ) : null}
                  {onToggleSharesMute ? (
                    <DeliveryMuteSwitch
                      checked={displaySharesMuted}
                      disabled={formBusy}
                      onToggle={handleToggleSharesMute}
                      ariaLabel={
                        displaySharesMuted
                          ? 'Unmute new shares from this friend'
                          : 'Mute new shares from this friend'
                      }
                      tooltip={
                        displaySharesMuted
                          ? 'Unmute new shares from this friend'
                          : 'Mute new shares from this friend'
                      }
                      icon={<ShareOutlinedIcon fontSize="small" />}
                    />
                  ) : null}
                </Stack>
              ) : null}
            </Stack>

            <TextField
              label="Public key"
              value={publicKeyText}
              fullWidth
              multiline
              minRows={format === 'json' ? 6 : 2}
              onClick={() => {
                if (publicKeyText) {
                  void copyAndNotify(publicKeyText);
                }
              }}
              slotProps={{
                input: {
                  readOnly: true,
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    cursor: publicKeyText ? 'pointer' : 'default',
                  },
                },
              }}
            />

            <TextField
              label="keyId"
              value={identity?.keyId ?? ''}
              fullWidth
              onClick={() => {
                if (identity?.keyId) {
                  void copyAndNotify(identity.keyId);
                }
              }}
              slotProps={{
                input: {
                  readOnly: true,
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    cursor: identity?.keyId ? 'pointer' : 'default',
                  },
                },
              }}
            />

            {isSelf ? (
              <Alert severity="info">This is your identity.</Alert>
            ) : (
              <>
                {isFriend ? (
                  <Alert severity="info">Already friends.</Alert>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Choose a local name to send a friend request. Names are
                    stored in this browser only.
                  </Typography>
                )}
                <TextField
                  autoFocus={!isFriend}
                  label="Name"
                  placeholder="Friend name"
                  value={friendName}
                  onChange={(event) => {
                    setFriendName(event.target.value);
                    setSaveError(null);
                    onClearError();
                  }}
                  fullWidth
                  disabled={formBusy}
                  error={Boolean(duplicateError ?? saveError)}
                  helperText={
                    duplicateError ??
                    saveError ??
                    (isFriend
                      ? 'Update the local name shown in your feed.'
                      : 'This name appears in your friends list.')
                  }
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') {
                      return;
                    }
                    if (canAddFriend) {
                      event.preventDefault();
                      handleAddFriend();
                    } else if (canSaveName) {
                      event.preventDefault();
                      handleSaveName();
                    }
                  }}
                />
                {friendshipsError ? (
                  <Alert severity="error">{friendshipsError}</Alert>
                ) : null}
                {error ? <Alert severity="error">{error}</Alert> : null}
                {muteError ? <Alert severity="error">{muteError}</Alert> : null}
                {info ? <Alert severity="info">{info}</Alert> : null}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
          {!isSelf && isFriend ? (
            <Button
              variant="contained"
              disabled={!canSaveName}
              onClick={handleSaveName}
            >
              {saveBusy ? 'Saving…' : 'Save name'}
            </Button>
          ) : null}
          {!isSelf && !isFriend ? (
            <Button
              variant="contained"
              disabled={!canAddFriend}
              onClick={handleAddFriend}
            >
              {busy ? 'Sending…' : 'Add friend'}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
      <CopiedToClipboardSnackbar {...snackbarProps} />
    </>
  );
}
