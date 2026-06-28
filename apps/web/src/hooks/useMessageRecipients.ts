import { useCallback, useContext, useMemo, useState } from 'react';
import {
  MOCK_EXTERNAL_RECIPIENT_COUNT,
  MockExternalRecipientContext,
} from '@/components/providers/MockExternalRecipientProvider.tsx';
import {
  formatMockRecipientsLabel,
  MOCK_RECIPIENTS_SELECTION,
} from '@/constants/mockRecipients.ts';
import type { ManifestRecipientKeys } from '@/crypto/manifestEncrypt.ts';
import { useStoredRecipients } from '@/hooks/useStoredRecipients.ts';

export function useMessageRecipients() {
  const {
    availableUsernames,
    selectedUsernames,
    setSelectedUsernames,
    recipients: storedRecipients,
    loadingUsers,
    loadingRecipientKeys: loadingStoredRecipientKeys,
    error,
  } = useStoredRecipients();
  const mockExternal = useContext(MockExternalRecipientContext);
  const [mockSelected, setMockSelected] = useState(true);

  const mockReady =
    mockExternal !== null &&
    !mockExternal.loading &&
    mockExternal.recipients.length === MOCK_EXTERNAL_RECIPIENT_COUNT;

  const mockOptionLabel = formatMockRecipientsLabel(
    MOCK_EXTERNAL_RECIPIENT_COUNT,
  );

  const availableOptions = useMemo(() => {
    if (mockReady) {
      return [MOCK_RECIPIENTS_SELECTION, ...availableUsernames];
    }
    return [...availableUsernames];
  }, [availableUsernames, mockReady]);

  const selectedOptions = useMemo(() => {
    if (mockReady && mockSelected) {
      return [MOCK_RECIPIENTS_SELECTION, ...selectedUsernames];
    }
    return [...selectedUsernames];
  }, [mockReady, mockSelected, selectedUsernames]);

  const setSelectedOptions = useCallback(
    (next: string[]) => {
      setSelectedUsernames(
        next.filter((option) => option !== MOCK_RECIPIENTS_SELECTION),
      );
      setMockSelected(next.includes(MOCK_RECIPIENTS_SELECTION));
    },
    [setSelectedUsernames],
  );

  const mockRecipients = useMemo<ManifestRecipientKeys[]>(
    () =>
      mockReady && mockSelected && mockExternal
        ? mockExternal.recipients.map(({ keyId, publicKey }) => ({
            keyId,
            publicKey,
          }))
        : [],
    [mockExternal, mockReady, mockSelected],
  );

  const recipients = useMemo(
    () => [...storedRecipients, ...mockRecipients],
    [mockRecipients, storedRecipients],
  );

  const loadingMockRecipients = Boolean(
    mockExternal?.loading ?? mockExternal === null,
  );
  const loadingRecipientKeys =
    loadingStoredRecipientKeys || (mockSelected && loadingMockRecipients);

  const getOptionLabel = useCallback(
    (option: string) =>
      option === MOCK_RECIPIENTS_SELECTION ? mockOptionLabel : option,
    [mockOptionLabel],
  );

  return {
    availableOptions,
    selectedOptions,
    setSelectedOptions,
    recipients,
    loadingUsers,
    loadingRecipientKeys,
    loadingMockRecipients,
    mockReady,
    getOptionLabel,
    error,
  };
}
