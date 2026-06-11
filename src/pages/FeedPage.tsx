import React, { useCallback } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { EncryptMessage } from '@/components/encrypt/EncryptMessage.tsx';
import { MessageInbox } from '@/components/inbox/MessageInbox.tsx';
import { MockExternalRecipientProvider } from '@/components/providers/MockExternalRecipientProvider.tsx';
import { useInboxMessages } from '@/hooks/useInboxMessages.ts';
import { useMessageRecipients } from '@/hooks/useMessageRecipients.ts';

function FeedContent() {
  const {
    availableOptions,
    selectedOptions,
    setSelectedOptions,
    recipients,
    loadingUsers,
    loadingRecipientKeys,
    loadingMockRecipients,
    getOptionLabel,
    error: recipientsError,
  } = useMessageRecipients();
  const {
    messages,
    loading: inboxLoading,
    error: inboxError,
    recipientKeyId,
    prependMessage,
  } = useInboxMessages();

  const handleMessageSent = useCallback(
    (message: Parameters<typeof prependMessage>[0]) => {
      void prependMessage(message);
    },
    [prependMessage],
  );

  return (
    <Box>
      <Stack spacing={3} sx={{ mx: 'auto', maxWidth: 600, px: 2, py: 2 }}>
        <EncryptMessage
          recipients={recipients}
          recipientsLoading={loadingRecipientKeys}
          onMessageSent={handleMessageSent}
          availableOptions={availableOptions}
          selectedOptions={selectedOptions}
          onSelectedOptionsChange={setSelectedOptions}
          getOptionLabel={getOptionLabel}
          loadingUsers={loadingUsers}
          loadingMockRecipients={loadingMockRecipients}
          recipientsError={recipientsError}
        />

        <MessageInbox
          messages={messages}
          loading={inboxLoading}
          error={inboxError}
          recipientKeyId={recipientKeyId}
        />
      </Stack>
    </Box>
  );
}

export function FeedPage() {
  return (
    <MockExternalRecipientProvider>
      <FeedContent />
    </MockExternalRecipientProvider>
  );
}
