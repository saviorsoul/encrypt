import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import type { ShareMessageHistoryProgress } from '@encrypt/core/feed/shareMessageHistory';
import { AppDialog } from '../components/AppDialog.tsx';

export type ShareMessageHistoryDialogProps = {
  open: boolean;
  friendName?: string | null;
  friendKeyId: string;
  busy: boolean;
  error: string | null;
  progress: ShareMessageHistoryProgress | null;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
  onClearError: () => void;
  onClearProgress?: () => void;
};

type FriendDisplay = {
  name: string | null;
  keyId: string;
};

export function ShareMessageHistoryDialog({
  open,
  friendName,
  friendKeyId,
  busy,
  error,
  progress,
  onClose,
  onConfirm,
  onClearError,
  onClearProgress,
}: ShareMessageHistoryDialogProps) {
  const [friendDisplay, setFriendDisplay] = useState<FriendDisplay | null>(
    null,
  );
  const [progressSnapshot, setProgressSnapshot] =
    useState<ShareMessageHistoryProgress | null>(null);
  const [sharedMessageCount, setSharedMessageCount] = useState<number | null>(
    null,
  );
  const progressSnapshotRef = useRef<ShareMessageHistoryProgress | null>(null);

  if (progress && progress.total >= 0) {
    progressSnapshotRef.current = progress;
  }

  useEffect(() => {
    if (progress) {
      setProgressSnapshot(progress);
    }
  }, [progress]);

  useEffect(() => {
    if (open && friendKeyId) {
      setFriendDisplay({
        name: friendName?.trim() || null,
        keyId: friendKeyId,
      });
    }
  }, [open, friendName, friendKeyId]);

  useEffect(() => {
    if (!open) {
      progressSnapshotRef.current = null;
      setProgressSnapshot(null);
      setSharedMessageCount(null);
    }
  }, [open]);

  const friendDisplayName =
    friendDisplay?.name || friendDisplay?.keyId || friendKeyId;
  const displayProgress =
    progressSnapshotRef.current ?? progressSnapshot ?? progress;
  const isComplete = sharedMessageCount != null;

  const finishClose = () => {
    onClearError();
    onClearProgress?.();
    onClose();
  };

  const handleClose = () => {
    if (busy) {
      return;
    }
    finishClose();
  };

  const handleConfirm = async () => {
    const shared = await onConfirm();
    if (!shared) {
      return;
    }

    const snapshot = progressSnapshotRef.current;
    setSharedMessageCount(snapshot?.total ?? 0);
  };

  const progressValue =
    displayProgress && displayProgress.total > 0
      ? Math.round((displayProgress.done / displayProgress.total) * 100)
      : busy
        ? undefined
        : 0;

  const successMessage =
    sharedMessageCount != null && sharedMessageCount > 0
      ? `Successfully shared ${sharedMessageCount} message${
          sharedMessageCount === 1 ? '' : 's'
        } with ${friendDisplayName}.`
      : `Share completed. There were no messages to share with ${friendDisplayName} before you became friends.`;

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title="Share message history"
      closeDisabled={busy}
      dismissOnBackdrop={false}
      fullWidth
      maxWidth="sm"
    >
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {isComplete ? (
            <Alert severity="success">{successMessage}</Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Share all history messages you created before becoming friends
                with:
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  overflowWrap: 'anywhere',
                }}
              >
                {friendDisplayName}
              </Typography>
            </>
          )}
          {busy ? (
            <Stack spacing={1}>
              <LinearProgress
                variant={
                  progressValue === undefined ? 'indeterminate' : 'determinate'
                }
                value={progressValue}
              />
              <Typography variant="caption" color="text.secondary">
                {displayProgress && displayProgress.total > 0
                  ? `Sharing ${displayProgress.done} of ${displayProgress.total} messages…`
                  : 'Preparing message history…'}
              </Typography>
            </Stack>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        {isComplete ? (
          <Button variant="contained" onClick={handleClose}>
            Close
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              data-testid="share-message-history-submit"
              variant="contained"
              disabled={busy}
              onClick={() => void handleConfirm()}
            >
              {busy ? 'Sharing…' : 'Share history'}
            </Button>
          </>
        )}
      </DialogActions>
    </AppDialog>
  );
}
