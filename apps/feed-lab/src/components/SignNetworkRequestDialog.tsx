import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { AppDialog } from '@/components/shared/AppDialog.tsx';
import {
  formatSignRequestPayload,
  signRequestMethodPalette,
  type SignRequestPreview,
} from '@lab/lib/formatSignRequest.ts';

type SignNetworkRequestDialogProps = {
  open: boolean;
  request: SignRequestPreview | null;
  onCancel: () => void;
  onSign: () => void;
};

type RequestTab = 'payload' | 'query';

function InspectorPanel({
  children,
  empty,
}: {
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        bgcolor:
          theme.palette.mode === 'dark'
            ? theme.palette.grey[900]
            : theme.palette.grey[100],
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.8rem',
        lineHeight: 1.5,
        maxHeight: 320,
        overflow: 'auto',
        p: 2,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: empty ? 'text.secondary' : 'text.primary',
      })}
    >
      {children}
    </Box>
  );
}

export function SignNetworkRequestDialog({
  open,
  request,
  onCancel,
  onSign,
}: SignNetworkRequestDialogProps) {
  const hasQuery = Boolean(
    request?.query && Object.keys(request.query).length > 0,
  );
  const hasPayload =
    request?.payload !== null && request?.payload !== undefined;
  const [tab, setTab] = useState<RequestTab>(() =>
    hasPayload ? 'payload' : 'query',
  );

  const payloadText = formatSignRequestPayload(request?.payload ?? null);
  const queryText =
    !request?.query || Object.keys(request.query).length === 0
      ? '(no query parameters)'
      : Object.entries(request.query)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');

  const activeTab: RequestTab =
    tab === 'query' && hasQuery
      ? 'query'
      : tab === 'payload' && hasPayload
        ? 'payload'
        : hasPayload
          ? 'payload'
          : 'query';

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      fullWidth
      maxWidth="md"
      aria-labelledby="sign-network-request-title"
    >
      <Box
        sx={(theme) => ({
          bgcolor:
            theme.palette.mode === 'dark'
              ? theme.palette.grey[800]
              : theme.palette.grey[50],
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: 2.5,
          py: 2,
        })}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', mb: 1.5 }}
        >
          <LockOutlinedIcon fontSize="small" sx={{ color: 'warning.main' }} />
          <Typography
            id="sign-network-request-title"
            variant="subtitle1"
            sx={{ fontWeight: 600 }}
          >
            Sign network request
          </Typography>
          <Chip
            size="small"
            label="awaiting signature"
            color="warning"
            variant="outlined"
            sx={{ ml: 'auto' }}
          />
        </Stack>

        {request ? (
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'flex-start', minWidth: 0 }}
          >
            <Box
              component="span"
              sx={(theme) => {
                const paletteKey = signRequestMethodPalette(request.method);
                const paletteColor = paletteKey
                  ? theme.palette[paletteKey]
                  : null;
                return {
                  bgcolor: paletteColor?.main ?? theme.palette.action.selected,
                  borderRadius: 0.75,
                  color:
                    paletteColor?.contrastText ?? theme.palette.text.primary,
                  flexShrink: 0,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                  px: 1,
                  py: 0.75,
                };
              }}
            >
              {request.method}
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.8rem',
                wordBreak: 'break-all',
                color: 'text.primary',
              }}
            >
              {request.url}
            </Typography>
          </Stack>
        ) : null}
      </Box>

      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Review the outgoing API call before your private key signs the request
          descriptor. Auth headers (nonce, time slot, signature) are added after
          you confirm.
        </Typography>

        <Tabs
          value={activeTab}
          onChange={(_, value: RequestTab) => setTab(value)}
          sx={{ mb: 1.5, minHeight: 36 }}
        >
          <Tab
            value="payload"
            label="Request payload"
            disabled={!hasPayload}
            sx={{ minHeight: 36, py: 0.5 }}
          />
          <Tab
            value="query"
            label="Query string"
            disabled={!hasQuery}
            sx={{ minHeight: 36, py: 0.5 }}
          />
        </Tabs>

        {activeTab === 'payload' ? (
          <InspectorPanel empty={!hasPayload}>{payloadText}</InspectorPanel>
        ) : (
          <InspectorPanel empty={!hasQuery}>{queryText}</InspectorPanel>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0 }}>
        <Button onClick={onCancel} sx={{ mr: 'auto' }}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="contained"
          color="primary"
          onClick={onSign}
          startIcon={<LockOutlinedIcon />}
        >
          Sign &amp; Send
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
