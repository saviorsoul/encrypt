import React, { useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import SendIcon from '@mui/icons-material/Send';
import type { ManifestRecipientKeys } from '@/crypto/manifestEncrypt.ts';
import type { StoredMessage } from '@/crypto/storedMessages.ts';
import { useEncryptManifest } from '@/hooks/useEncryptManifest.ts';
import { RecipientMultiSelect } from '@/components/encrypt/RecipientMultiSelect.tsx';

type EncryptMessageProps = {
  recipients: ManifestRecipientKeys[];
  recipientsLoading?: boolean;
  onMessageSent?: (message: StoredMessage) => void;
  availableOptions: string[];
  selectedOptions: string[];
  onSelectedOptionsChange: (options: string[]) => void;
  getOptionLabel: (option: string) => string;
  loadingUsers?: boolean;
  loadingMockRecipients?: boolean;
  recipientsError?: string | null;
};

export function EncryptMessage({
  recipients,
  recipientsLoading = false,
  onMessageSent,
  availableOptions,
  selectedOptions,
  onSelectedOptionsChange,
  getOptionLabel,
  loadingUsers = false,
  loadingMockRecipients = false,
  recipientsError = null,
}: EncryptMessageProps) {
  const {
    keysLoading,
    keysReady,
    message,
    setMessage,
    error,
    busy,
    handleSend,
  } = useEncryptManifest({ recipients, recipientsLoading, onMessageSent });

  const handleSubmit = useCallback(
    (event: React.SubmitEvent) => {
      event.preventDefault();
      void handleSend();
    },
    [handleSend],
  );

  const loadingRecipients = loadingUsers || loadingMockRecipients;

  if (keysLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          Loading keys…
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <TextField
        label="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        multiline
        minRows={3}
        fullWidth
        placeholder="Enter text to encrypt..."
      />

      <Box>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {loadingRecipients ? (
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}
            >
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {loadingMockRecipients && !loadingUsers
                  ? 'Generating mock recipients…'
                  : 'Loading recipients…'}
              </Typography>
            </Box>
          ) : availableOptions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              No recipients available yet. Log in as another user on this
              browser to add stored users, or wait for mock recipients to finish
              loading.
            </Typography>
          ) : (
            <RecipientMultiSelect
              options={availableOptions}
              value={selectedOptions}
              onChange={onSelectedOptionsChange}
              getOptionLabel={getOptionLabel}
            />
          )}

          <Button
            type="submit"
            variant="contained"
            disabled={!keysReady || !message.trim()}
            loading={busy}
            loadingPosition="start"
            startIcon={<SendIcon />}
            sx={{ flexShrink: 0, height: 40 }}
          >
            Send message
          </Button>
        </Box>

        {!loadingRecipients && availableOptions.length > 0 && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5 }}
          >
            Public keys are loaded from IndexedDB for each selected user. Mock
            users are generated locally for stress testing.
          </Typography>
        )}
      </Box>

      {recipientsError && (
        <Typography color="error" variant="body2">
          {recipientsError}
        </Typography>
      )}

      {error && (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      )}
    </Box>
  );
}
