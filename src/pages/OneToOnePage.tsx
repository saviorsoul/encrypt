import React, { useCallback, useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { DecryptMessageDialog } from '@/components/one-to-one/DecryptMessageDialog.tsx';
import { NameUnknownRecipientDialog } from '@/components/one-to-one/NameUnknownRecipientDialog.tsx';
import { OneToOneConversationThread } from '@/components/one-to-one/OneToOneConversationThread.tsx';
import { OneToOneEncryption } from '@/components/one-to-one/OneToOneEncryption.tsx';
import { useAuth } from '@/hooks/useAuth.ts';
import { useOneToOneThread } from '@/hooks/useOneToOneThread.ts';
import { useStoredUsernames } from '@/hooks/useStoredUsernames.ts';
import {
  decryptOneToOnePayload,
  decryptOneToOneThreadItemsWithUploadedPrivateKey,
  isPrivateKeyFileSelectionCancelled,
} from '@/crypto/oneToOneMessageDecrypt.ts';
import {
  getMessagePartyKeyIdsFromPayload,
  getPeerKeyIdForViewer,
  resolvePeerPublicJwk,
  messageBelongsToConversation,
  type MessagePartyKeyIds,
} from '@/crypto/oneToOneMessageParties.ts';
import {
  getUsernameForKeyId,
  loadStoredPublicKeyMaterialByKeyId,
  saveStoredRecipientForUsername,
} from '@/crypto/storedPublicKeys.ts';
import { loadOneToOneThread } from '@/crypto/storedOneToOneMessages.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import type {
  EncryptedMessageFingerprint,
  PartyKeyIds,
} from '@/types/oneToOne.ts';
import {
  encryptedMessageFingerprintFromPayloadJson,
  findThreadItemIdByFingerprint,
  isThreadItemDecrypted,
  type OneToOneThreadItem,
} from '@/types/oneToOne.ts';

const DUPLICATE_MESSAGE_FEEDBACK_MS = 5000;

const ALREADY_IN_THREAD_MESSAGE = 'The message has already been added.';

function conversationSwitchedMessage(username: string): string {
  return `This message doesn't belong to the current conversation. Changed conversation to ${username} recipient.`;
}

type UnknownRecipientDialogState = {
  keyId: string;
  publicJwk: JsonWebKey;
  messageParties?: MessagePartyKeyIds;
  pendingDuplicateMessageId?: string;
};

type HandleDecryptResult = {
  success: boolean;
  closeDialog: boolean;
};

type ConversationSwitchResult = 'unknown-recipient' | 'switched' | false;

type PendingDuplicateResolution = {
  messageId: string;
};

async function findDuplicateInConversation(
  viewerKeyId: string,
  peerKeyId: string,
  fingerprint: EncryptedMessageFingerprint,
  inMemoryThread: OneToOneThreadItem[],
  inMemoryViewerKeyId: string | null,
  inMemoryPeerKeyId: string | null,
): Promise<{ id: string; item: OneToOneThreadItem } | null> {
  const isCurrentConversation =
    viewerKeyId === inMemoryViewerKeyId && peerKeyId === inMemoryPeerKeyId;

  const conversationThread = isCurrentConversation
    ? inMemoryThread
    : await loadOneToOneThread(viewerKeyId, peerKeyId);

  const existingId = findThreadItemIdByFingerprint(
    conversationThread,
    fingerprint,
  );
  if (existingId === null) {
    return null;
  }

  const item = conversationThread.find(
    (threadItem) => threadItem.id === existingId,
  );
  return item ? { id: existingId, item } : null;
}

export function OneToOnePage() {
  const { user } = useAuth();
  const { allUsernames, refresh: refreshStoredUsernames } =
    useStoredUsernames();
  const [partyKeyIds, setPartyKeyIds] = useState<PartyKeyIds>({
    senderKeyId: null,
    recipientKeyId: null,
  });
  const [decryptDialogOpen, setDecryptDialogOpen] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decryptBusy, setDecryptBusy] = useState(false);
  const [bulkDecryptBusy, setBulkDecryptBusy] = useState(false);
  const [bulkDecryptError, setBulkDecryptError] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [duplicateSnackbar, setDuplicateSnackbar] = useState({
    open: false,
    key: 0,
  });
  const [conversationSwitchSnackbar, setConversationSwitchSnackbar] = useState({
    open: false,
    message: '',
    key: 0,
  });
  const [peerLabel, setPeerLabel] = useState('Recipient');
  const [decryptingMessageId, setDecryptingMessageId] = useState<string | null>(
    null,
  );
  const [decryptErrorById, setDecryptErrorById] = useState<
    Record<string, string | null>
  >({});
  const [peerKeyIdToSelect, setPeerKeyIdToSelect] = useState<string | null>(
    null,
  );
  const [unknownRecipientDialog, setUnknownRecipientDialog] =
    useState<UnknownRecipientDialogState | null>(null);
  const [unknownRecipientSaving, setUnknownRecipientSaving] = useState(false);
  const [unknownRecipientError, setUnknownRecipientError] = useState<
    string | null
  >(null);
  const [pendingDuplicateResolution, setPendingDuplicateResolution] =
    useState<PendingDuplicateResolution | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  const viewerKeyId = partyKeyIds.senderKeyId;

  const {
    thread,
    loading: threadLoading,
    appendThreadItem,
    markThreadItemDecrypted,
  } = useOneToOneThread({
    viewerKeyId,
    peerKeyId: partyKeyIds.recipientKeyId,
    partySenderKeyId: partyKeyIds.senderKeyId,
    partyRecipientKeyId: partyKeyIds.recipientKeyId,
  });

  const clearHighlightTimeout = useCallback(() => {
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearHighlightTimeout(), [clearHighlightTimeout]);

  useEffect(() => {
    if (!partyKeyIds.recipientKeyId) {
      setPeerLabel('Recipient');
      return;
    }

    let cancelled = false;
    const peerKeyId = partyKeyIds.recipientKeyId;

    void getUsernameForKeyId(peerKeyId).then((username) => {
      if (cancelled) {
        return;
      }
      setPeerLabel(username ?? `${peerKeyId.slice(0, 12)}…`);
    });

    return () => {
      cancelled = true;
    };
  }, [partyKeyIds.recipientKeyId]);

  const highlightMessage = useCallback(
    (messageId: string | null) => {
      clearHighlightTimeout();
      setHighlightedMessageId(messageId);
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedMessageId(null);
        highlightTimeoutRef.current = null;
      }, DUPLICATE_MESSAGE_FEEDBACK_MS);
    },
    [clearHighlightTimeout],
  );

  const showDuplicateMessageFeedback = useCallback(
    (messageId: string | null) => {
      setDuplicateSnackbar((prev) => ({ open: true, key: prev.key + 1 }));
      highlightMessage(messageId);
    },
    [highlightMessage],
  );

  const showConversationSwitchedFeedback = useCallback((username: string) => {
    setConversationSwitchSnackbar((prev) => ({
      open: true,
      message: conversationSwitchedMessage(username),
      key: prev.key + 1,
    }));
  }, []);

  const handleDecryptMessage = useCallback(
    async (item: OneToOneThreadItem): Promise<boolean> => {
      if (isThreadItemDecrypted(item)) {
        return true;
      }

      setDecryptErrorById((prev) => ({ ...prev, [item.id]: null }));
      setDecryptingMessageId(item.id);

      try {
        const { text } = await decryptOneToOnePayload(
          item.encryptedPayload,
          partyKeyIds,
        );
        markThreadItemDecrypted(item.id, text);
        return true;
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return false;
        }
        setDecryptErrorById((prev) => ({
          ...prev,
          [item.id]: errorMessage(e, 'Decryption failed.'),
        }));
        return false;
      } finally {
        setDecryptingMessageId(null);
      }
    },
    [partyKeyIds, markThreadItemDecrypted],
  );

  const finishDecryptAndAppend = useCallback(
    async (payload: string): Promise<boolean> => {
      setDecryptBusy(true);
      try {
        const fingerprint = encryptedMessageFingerprintFromPayloadJson(payload);
        if (fingerprint !== null) {
          const existingId = findThreadItemIdByFingerprint(thread, fingerprint);
          if (existingId !== null) {
            showDuplicateMessageFeedback(existingId);
            return true;
          }
        }

        const { text, side, manifestSenderKeyId } =
          await decryptOneToOnePayload(payload, partyKeyIds);
        const encryptedAt = Date.now();
        const newItem: OneToOneThreadItem = {
          id: crypto.randomUUID(),
          createdAt: encryptedAt,
          encryptedAt,
          side,
          encryptedPayload: payload,
        };

        await appendThreadItem(newItem, side, {
          manifestSenderKeyId,
          decryptedText: text,
        });
        return true;
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return false;
        }
        setDecryptError(errorMessage(e, 'Decryption failed.'));
        return false;
      } finally {
        setDecryptBusy(false);
      }
    },
    [partyKeyIds, thread, appendThreadItem, showDuplicateMessageFeedback],
  );

  const handleExistingDuplicate = useCallback(
    async (
      duplicate: { id: string; item: OneToOneThreadItem },
      targetPeerKeyId: string,
      messageParties: MessagePartyKeyIds,
    ): Promise<boolean> => {
      const needsSwitch = !messageBelongsToConversation(
        messageParties,
        partyKeyIds,
      );

      if (needsSwitch) {
        const existingUser =
          await loadStoredPublicKeyMaterialByKeyId(targetPeerKeyId);
        if (!existingUser?.username) {
          if (!viewerKeyId) {
            return false;
          }

          const publicJwk = await resolvePeerPublicJwk(
            viewerKeyId,
            targetPeerKeyId,
          );
          if (!publicJwk) {
            setPeerKeyIdToSelect(targetPeerKeyId);
            setPendingDuplicateResolution({ messageId: duplicate.id });
            return true;
          }

          setUnknownRecipientError(null);
          setUnknownRecipientDialog({
            keyId: targetPeerKeyId,
            publicJwk,
            pendingDuplicateMessageId: duplicate.id,
          });
          return true;
        }

        setPendingDuplicateResolution({
          messageId: duplicate.id,
        });
        setPeerKeyIdToSelect(targetPeerKeyId);
        return true;
      }

      if (!isThreadItemDecrypted(duplicate.item)) {
        const decrypted = await handleDecryptMessage(duplicate.item);
        if (decrypted) {
          highlightMessage(duplicate.id);
        }
      } else {
        showDuplicateMessageFeedback(duplicate.id);
      }
      return true;
    },
    [
      viewerKeyId,
      partyKeyIds,
      handleDecryptMessage,
      highlightMessage,
      showDuplicateMessageFeedback,
    ],
  );

  const handlePeerNeedsName = useCallback(
    (peer: { keyId: string; publicJwk: JsonWebKey }) => {
      setPeerKeyIdToSelect(null);
      setUnknownRecipientError(null);
      setUnknownRecipientDialog({
        keyId: peer.keyId,
        publicJwk: peer.publicJwk,
      });
    },
    [],
  );

  const switchToMessageConversation = useCallback(
    async (
      _payload: string,
      messageParties: MessagePartyKeyIds,
    ): Promise<ConversationSwitchResult> => {
      if (!viewerKeyId) {
        setDecryptError('Your public key is not ready.');
        return false;
      }

      let peerKeyId: string;
      try {
        peerKeyId = getPeerKeyIdForViewer(viewerKeyId, messageParties);
      } catch (e) {
        setDecryptError(errorMessage(e, 'This message is not for you.'));
        return false;
      }

      const existingUser = await loadStoredPublicKeyMaterialByKeyId(peerKeyId);
      if (!existingUser?.username) {
        const publicJwk = await resolvePeerPublicJwk(
          viewerKeyId,
          peerKeyId,
          _payload,
        );
        if (!publicJwk) {
          setDecryptError('Could not read recipient public key.');
          return false;
        }

        setUnknownRecipientError(null);
        setUnknownRecipientDialog({
          keyId: peerKeyId,
          publicJwk,
          messageParties,
        });
        return 'unknown-recipient';
      }

      showConversationSwitchedFeedback(existingUser.username);
      setPeerKeyIdToSelect(peerKeyId);
      return 'switched';
    },
    [viewerKeyId, showConversationSwitchedFeedback],
  );

  useEffect(() => {
    if (
      !pendingDuplicateResolution ||
      threadLoading ||
      peerKeyIdToSelect !== null
    ) {
      return;
    }

    const existing = thread.find(
      (item) => item.id === pendingDuplicateResolution.messageId,
    );
    if (!existing) {
      return;
    }

    setPendingDuplicateResolution(null);
    showDuplicateMessageFeedback(existing.id);
  }, [
    pendingDuplicateResolution,
    threadLoading,
    peerKeyIdToSelect,
    thread,
    showDuplicateMessageFeedback,
  ]);

  const senderTitle = user?.username ?? 'Sender';

  const handleOpenDecryptDialog = useCallback(() => {
    setDecryptError(null);
    setDecryptDialogOpen(true);
  }, []);

  const handleCloseDecryptDialog = useCallback(() => {
    if (decryptBusy || unknownRecipientSaving) {
      return;
    }
    setUnknownRecipientDialog(null);
    setUnknownRecipientError(null);
    setDecryptDialogOpen(false);
  }, [decryptBusy, unknownRecipientSaving]);

  const handleDecrypt = useCallback(
    async (payloadText: string): Promise<HandleDecryptResult> => {
      setDecryptError(null);

      const payload = payloadText.trim();
      if (!payload) {
        setDecryptError('Paste the encrypted JSON payload to decrypt.');
        return { success: false, closeDialog: false };
      }

      setDecryptBusy(true);
      try {
        const messageParties = await getMessagePartyKeyIdsFromPayload(payload);

        if (!viewerKeyId) {
          setDecryptError('Your public key is not ready.');
          return { success: false, closeDialog: false };
        }

        let targetPeerKeyId: string;
        try {
          targetPeerKeyId = getPeerKeyIdForViewer(viewerKeyId, messageParties);
        } catch (e) {
          setDecryptError(errorMessage(e, 'This message is not for you.'));
          return { success: false, closeDialog: false };
        }

        const fingerprint = encryptedMessageFingerprintFromPayloadJson(payload);
        if (fingerprint !== null) {
          const duplicate = await findDuplicateInConversation(
            viewerKeyId,
            targetPeerKeyId,
            fingerprint,
            thread,
            viewerKeyId,
            partyKeyIds.recipientKeyId,
          );

          if (duplicate !== null) {
            const handled = await handleExistingDuplicate(
              duplicate,
              targetPeerKeyId,
              messageParties,
            );
            return { success: handled, closeDialog: handled };
          }
        }

        if (!messageBelongsToConversation(messageParties, partyKeyIds)) {
          const switchResult = await switchToMessageConversation(
            payload,
            messageParties,
          );
          if (switchResult === 'unknown-recipient') {
            return { success: true, closeDialog: false };
          }
          if (switchResult === 'switched') {
            return { success: true, closeDialog: true };
          }
          return { success: false, closeDialog: false };
        }

        const decrypted = await finishDecryptAndAppend(payload);
        return { success: decrypted, closeDialog: decrypted };
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return { success: false, closeDialog: false };
        }
        setDecryptError(errorMessage(e, 'Decryption failed.'));
        return { success: false, closeDialog: false };
      } finally {
        setDecryptBusy(false);
      }
    },
    [
      viewerKeyId,
      partyKeyIds,
      thread,
      handleExistingDuplicate,
      switchToMessageConversation,
      finishDecryptAndAppend,
    ],
  );

  const handleCloseUnknownRecipientDialog = useCallback(() => {
    if (unknownRecipientSaving) {
      return;
    }
    setUnknownRecipientDialog(null);
    setUnknownRecipientError(null);
  }, [unknownRecipientSaving]);

  const handleSaveUnknownRecipient = useCallback(
    async (username: string) => {
      if (!unknownRecipientDialog) {
        return;
      }

      if (allUsernames.includes(username)) {
        setUnknownRecipientError(
          `"${username}" already exists. Choose a unique name.`,
        );
        return;
      }

      setUnknownRecipientSaving(true);
      setUnknownRecipientError(null);

      try {
        const { keyId, publicJwk, pendingDuplicateMessageId } =
          unknownRecipientDialog;
        await saveStoredRecipientForUsername(username, publicJwk);
        await refreshStoredUsernames();
        setUnknownRecipientDialog(null);
        if (pendingDuplicateMessageId) {
          setPendingDuplicateResolution({
            messageId: pendingDuplicateMessageId,
          });
        }
        setPeerKeyIdToSelect(keyId);
      } catch (e) {
        setUnknownRecipientError(errorMessage(e, 'Failed to save recipient.'));
      } finally {
        setUnknownRecipientSaving(false);
      }
    },
    [unknownRecipientDialog, allUsernames, refreshStoredUsernames],
  );

  const handleDecryptFromDialog = useCallback(
    async (payload: string) => {
      const result = await handleDecrypt(payload);
      if (result.success && result.closeDialog) {
        setDecryptDialogOpen(false);
      }
    },
    [handleDecrypt],
  );

  const isImportMessageBlocked =
    unknownRecipientDialog !== null ||
    unknownRecipientSaving ||
    peerKeyIdToSelect !== null ||
    threadLoading;

  const hasUndecryptedMessages = thread.some(
    (item) => !isThreadItemDecrypted(item),
  );

  const handleDecryptAllMessages = useCallback(() => {
    const undecryptedItems = thread.filter(
      (item) => !isThreadItemDecrypted(item),
    );
    if (undecryptedItems.length === 0) {
      return;
    }

    setBulkDecryptError(null);

    void (async () => {
      setBulkDecryptBusy(true);
      try {
        const results = await decryptOneToOneThreadItemsWithUploadedPrivateKey(
          undecryptedItems,
          partyKeyIds,
        );

        for (const item of undecryptedItems) {
          const result = results[item.id];
          if (!result) {
            continue;
          }
          if (result.text !== null) {
            markThreadItemDecrypted(item.id, result.text);
            setDecryptErrorById((prev) => ({ ...prev, [item.id]: null }));
          } else if (result.error !== null) {
            setDecryptErrorById((prev) => ({
              ...prev,
              [item.id]: result.error,
            }));
          }
        }
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return;
        }
        setBulkDecryptError(errorMessage(e, 'Bulk decryption failed.'));
      } finally {
        setBulkDecryptBusy(false);
      }
    })();
  }, [thread, partyKeyIds, markThreadItemDecrypted]);

  const isDecryptBusy =
    decryptBusy || bulkDecryptBusy || decryptingMessageId !== null;

  return (
    <Box>
      <Box sx={{ mx: 'auto', maxWidth: 1400, px: 2, py: 2 }}>
        <OneToOneEncryption
          thread={thread}
          threadLoading={threadLoading}
          peerKeyIdToSelect={peerKeyIdToSelect}
          onPeerKeyIdSelected={() => setPeerKeyIdToSelect(null)}
          onPeerNeedsName={handlePeerNeedsName}
          onEncryptedMessage={(item, side, decryptedText) =>
            appendThreadItem(item, side, { decryptedText })
          }
          onImportMessage={handleOpenDecryptDialog}
          importBusy={isDecryptBusy}
          onPartyKeyIdsChange={setPartyKeyIds}
          onPeerLabelChange={setPeerLabel}
          threadActions={
            <Tooltip
              title={
                bulkDecryptBusy
                  ? 'Decrypting…'
                  : hasUndecryptedMessages
                    ? 'Decrypt all messages'
                    : 'All messages decrypted'
              }
            >
              <span>
                <IconButton
                  size="small"
                  aria-label="Decrypt all messages"
                  disabled={
                    isDecryptBusy || threadLoading || !hasUndecryptedMessages
                  }
                  onClick={handleDecryptAllMessages}
                >
                  <LockOpenIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          }
        />

        {bulkDecryptError && (
          <Typography
            color="error"
            variant="body2"
            sx={{ px: { xs: 1, sm: 2 }, pb: 1, textAlign: 'center' }}
          >
            {bulkDecryptError}
          </Typography>
        )}

        <Box
          sx={{
            px: { xs: 1, sm: 2 },
            py: 2,
            overflowY: 'auto',
            maxHeight: { xs: 360, md: 480 },
          }}
        >
          {threadLoading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                py: 3,
              }}
            >
              <CircularProgress size={22} />
              <Typography variant="body2" color="text.secondary">
                Loading conversation…
              </Typography>
            </Box>
          ) : (
            <OneToOneConversationThread
              thread={thread}
              viewerKeyId={viewerKeyId}
              currentUserLabel={senderTitle}
              peerLabel={peerLabel}
              highlightedMessageId={highlightedMessageId}
              decryptingMessageId={decryptingMessageId}
              decryptBusy={isDecryptBusy}
              decryptErrorById={decryptErrorById}
              onDecryptMessage={(item) => void handleDecryptMessage(item)}
            />
          )}
        </Box>
      </Box>

      <DecryptMessageDialog
        open={decryptDialogOpen}
        decrypting={decryptBusy}
        decryptDisabled={isImportMessageBlocked}
        error={decryptError}
        onClose={handleCloseDecryptDialog}
        onPayloadChange={() => setDecryptError(null)}
        onDecrypt={(payload) => void handleDecryptFromDialog(payload)}
      />

      <NameUnknownRecipientDialog
        open={unknownRecipientDialog !== null}
        onClose={handleCloseUnknownRecipientDialog}
        existingUsernames={allUsernames}
        saving={unknownRecipientSaving}
        error={unknownRecipientError}
        onNameChange={() => setUnknownRecipientError(null)}
        onSave={(username) => void handleSaveUnknownRecipient(username)}
        stacked
      />

      <Snackbar
        key={`duplicate-${duplicateSnackbar.key}`}
        open={duplicateSnackbar.open}
        autoHideDuration={DUPLICATE_MESSAGE_FEEDBACK_MS}
        onClose={() =>
          setDuplicateSnackbar((prev) => ({ ...prev, open: false }))
        }
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          variant="filled"
          onClose={() =>
            setDuplicateSnackbar((prev) => ({ ...prev, open: false }))
          }
          sx={{ width: '100%' }}
        >
          {ALREADY_IN_THREAD_MESSAGE}
        </Alert>
      </Snackbar>

      <Snackbar
        key={`conversation-switch-${conversationSwitchSnackbar.key}`}
        open={conversationSwitchSnackbar.open}
        autoHideDuration={DUPLICATE_MESSAGE_FEEDBACK_MS}
        onClose={() =>
          setConversationSwitchSnackbar((prev) => ({ ...prev, open: false }))
        }
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          variant="filled"
          onClose={() =>
            setConversationSwitchSnackbar((prev) => ({ ...prev, open: false }))
          }
          sx={{ width: '100%' }}
        >
          {conversationSwitchSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
