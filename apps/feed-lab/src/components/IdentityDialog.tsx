import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  formatEcPublicKeyText,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/ecPublicKey';
import { prettifyJsonText } from '@/utils/prettifyJsonText.ts';
import { CopiedToClipboardSnackbar } from '@/components/CopiedToClipboardSnackbar.tsx';
import { useCopiedToClipboardSnackbar } from '@/hooks/useCopiedToClipboardSnackbar.tsx';

export type IdentityDialogTarget = {
  keyId: string;
  publicKey: { x: string; y: string };
  label: string;
};

type IdentityDialogProps = {
  open: boolean;
  identity: IdentityDialogTarget | null;
  isSelf: boolean;
  isFriend: boolean;
  existingUsername: string;
  existingUsernames: string[];
  busy: boolean;
  error: string | null;
  info: string | null;
  onClose: () => void;
  onExited?: () => void;
  onClearError: () => void;
  onAddFriend: (name: string) => Promise<{ ok: boolean }>;
  onSaveName: (name: string) => Promise<{ ok: boolean; error?: string }>;
};

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
  busy,
  error,
  info,
  onClose,
  onExited,
  onClearError,
  onAddFriend,
  onSaveName,
}: IdentityDialogProps) {
  const [format, setFormat] = useState<'xy' | 'json'>('xy');
  const [friendName, setFriendName] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
    } else {
      setSaveError(null);
    }
  }

  if ((identity?.keyId ?? null) !== prevIdentityKeyId) {
    setPrevIdentityKeyId(identity?.keyId ?? null);
    if (open) {
      setFriendName(existingUsername);
      setSaveError(null);
    }
  }

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
  const displayError = open ? (duplicateError ?? saveError ?? error) : null;
  const formBusy = busy || saveBusy;
  const canAddFriend =
    Boolean(identity) &&
    !isSelf &&
    !isFriend &&
    trimmedName.length > 0 &&
    !formBusy &&
    !nameExists;
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
      return;
    }
    onClearError();
    setSaveError(null);
    onClose();
  }, [formBusy, onClearError, onClose]);

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
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
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
                  error={Boolean(displayError)}
                  helperText={
                    displayError ??
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
                {info ? <Alert severity="info">{info}</Alert> : null}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={formBusy}>
            Close
          </Button>
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
