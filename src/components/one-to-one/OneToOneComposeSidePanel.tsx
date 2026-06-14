import React, { useCallback, useState } from 'react';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import SendAndArchiveOutlinedIcon from '@mui/icons-material/SendAndArchiveOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { StepOutputTextField } from '@/components/manifest-steps/StepOutputTextField.tsx';
import type { CopyState } from '@/types/copyState.ts';

type PrimaryActionMode = 'encrypt' | 'import';

type OneToOneComposeSidePanelProps = {
  title: string;
  titleAction?: React.ReactNode;
  titleOnRight?: boolean;
  publicKeyJwkText: string;
  jwkError: string | null;
  jwkImporting: boolean;
  keysValid: boolean;
  bothKeysValid: boolean;
  actionError: string | null;
  actionBusy: boolean;
  primaryActionMode?: PrimaryActionMode;
  onPrimaryAction: () => void;
  publicKeySectionCollapsed?: boolean;
};

export function OneToOneComposeSidePanel({
  title,
  titleAction,
  titleOnRight = false,
  publicKeyJwkText,
  jwkError,
  jwkImporting,
  keysValid,
  bothKeysValid,
  actionError,
  actionBusy,
  primaryActionMode = 'encrypt',
  onPrimaryAction,
  publicKeySectionCollapsed = false,
}: OneToOneComposeSidePanelProps) {
  const [publicKeyDialogOpen, setPublicKeyDialogOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const buttonsEnabled = keysValid && !jwkImporting;
  const alignEndOnMd = titleOnRight ? 'flex-end' : 'flex-start';
  const primaryActionEnabled =
    primaryActionMode === 'import'
      ? !actionBusy
      : buttonsEnabled && !actionBusy && bothKeysValid;
  const primaryActionLabel =
    primaryActionMode === 'import' ? 'Import message' : 'Encrypt message';
  const PrimaryActionIcon =
    primaryActionMode === 'import'
      ? CloudDownloadOutlinedIcon
      : SendAndArchiveOutlinedIcon;

  const copyButtonLabel =
    copyState === 'ok'
      ? 'Copied'
      : copyState === 'err'
        ? 'Copy failed'
        : 'Copy';

  const handleCopyPublicKey = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicKeyJwkText);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  }, [publicKeyJwkText]);

  return (
    <Stack
      spacing={2}
      sx={{
        flex: 1,
        minWidth: 0,
        px: 0.5,
        py: 0.5,
      }}
    >
      <Box sx={{ width: '100%' }}>
        <Stack spacing={1} sx={{ width: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              width: '100%',
              justifyContent: titleOnRight ? 'flex-end' : 'flex-start',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flexWrap: 'wrap',
                flexDirection: titleOnRight ? 'row-reverse' : 'row',
              }}
            >
              <Typography variant="subtitle1" component="h2">
                {title}
              </Typography>
              <Collapse
                in={publicKeySectionCollapsed}
                orientation="horizontal"
                collapsedSize={0}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexDirection: titleOnRight ? 'row-reverse' : 'row',
                    ml: titleOnRight ? 0 : 1,
                    mr: titleOnRight ? 1 : 0,
                  }}
                >
                  <Tooltip title="Show public key">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Show public key"
                        onClick={() => setPublicKeyDialogOpen(true)}
                      >
                        <VisibilityOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Collapse>
            </Box>
          </Box>
          {titleAction && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
                alignSelf: alignEndOnMd,
                justifyContent: alignEndOnMd,
              }}
            >
              {titleAction}
            </Box>
          )}
        </Stack>

        <Collapse
          in={!publicKeySectionCollapsed}
          sx={{
            width: '100%',
            ml: 0,
            pl: 0,
            mt: 1,
          }}
        >
          <StepOutputTextField
            label="JSON public JWK with kty, crv, x, and y"
            value={publicKeyJwkText}
            slotProps={{
              input: { readOnly: true },
            }}
            multiline
            rows={6}
            fullWidth
            error={Boolean(jwkError)}
            sx={{ ml: 0, pl: 0, mt: 1 }}
          />
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              alignItems: 'center',
              justifyContent: alignEndOnMd,
              mt: 1,
            }}
          >
            <Button
              variant="contained"
              disabled={!primaryActionEnabled}
              onClick={onPrimaryAction}
              endIcon={
                titleOnRight || primaryActionMode === 'import' ? null : (
                  <PrimaryActionIcon fontSize="small" />
                )
              }
              startIcon={
                titleOnRight || primaryActionMode === 'import' ? (
                  <PrimaryActionIcon
                    fontSize="small"
                    sx={{
                      transform:
                        primaryActionMode === 'encrypt' && titleOnRight
                          ? 'rotate(180deg)'
                          : undefined,
                    }}
                  />
                ) : null
              }
            >
              {primaryActionLabel}
            </Button>
          </Box>
        </Collapse>
      </Box>

      {actionError && <Alert severity="error">{actionError}</Alert>}

      <Dialog
        open={publicKeyDialogOpen}
        onClose={() => {
          setPublicKeyDialogOpen(false);
          setCopyState('idle');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{title} — public key</DialogTitle>
        <DialogContent>
          <StepOutputTextField
            label="JSON public JWK with kty, crv, x, and y"
            value={publicKeyJwkText}
            slotProps={{
              input: { readOnly: true },
            }}
            multiline
            rows={6}
            fullWidth
            error={Boolean(jwkError)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setPublicKeyDialogOpen(false);
              setCopyState('idle');
            }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            color={copyState === 'ok' ? 'success' : 'primary'}
            onClick={() => void handleCopyPublicKey()}
          >
            {copyButtonLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
