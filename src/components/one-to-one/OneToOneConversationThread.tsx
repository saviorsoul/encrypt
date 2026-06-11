import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import {
  isThreadItemDecrypted,
  type OneToOneThreadItem,
} from '@/types/oneToOne.ts';
import type { CopyState } from '@/types/copyState.ts';

const MESSAGE_ENTER = 'oneToOneMessageEnter';
const MESSAGE_ENTER_MS = 360;
const MESSAGE_STAGGER_MS = 90;

function ConversationBubbleEnter({
  messageId,
  animateEntry,
  staggerIndex,
  alignEnd,
  onAnimationDone,
  children,
}: {
  messageId: string;
  animateEntry: boolean;
  staggerIndex: number;
  alignEnd: boolean;
  onAnimationDone: (messageId: string) => void;
  children: React.ReactNode;
}) {
  const [shouldAnimate] = useState(animateEntry);

  useEffect(() => {
    if (!shouldAnimate) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onAnimationDone(messageId);
    }
  }, [messageId, onAnimationDone, shouldAnimate]);

  const handleAnimationEnd = useCallback(
    (event: React.AnimationEvent<HTMLDivElement>) => {
      if (event.animationName !== MESSAGE_ENTER) {
        return;
      }
      onAnimationDone(messageId);
    },
    [messageId, onAnimationDone],
  );

  return (
    <Box
      onAnimationEnd={handleAnimationEnd}
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: alignEnd ? 'flex-end' : 'flex-start',
        [`@keyframes ${MESSAGE_ENTER}`]: {
          from: {
            opacity: 0,
            transform: 'translateY(-14px)',
          },
          to: {
            opacity: 1,
            transform: 'translateY(0)',
          },
        },
        animation: shouldAnimate
          ? `${MESSAGE_ENTER} ${MESSAGE_ENTER_MS}ms ease-out ${staggerIndex * MESSAGE_STAGGER_MS}ms both`
          : 'none',
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      }}
    >
      {children}
    </Box>
  );
}

function isCurrentUserMessage(
  item: OneToOneThreadItem,
  viewerKeyId: string | null,
): boolean {
  return viewerKeyId !== null && item.side === 'sender';
}

function formatEncryptionDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

type ConversationBubbleProps = {
  item: OneToOneThreadItem;
  authorLabel: string;
  highlighted: boolean;
  decrypting: boolean;
  decryptError: string | null;
  onDecrypt: () => void;
  onRight: boolean;
  decryptDisabled: boolean;
};

function ConversationBubble({
  item,
  authorLabel,
  highlighted,
  decrypting,
  decryptError,
  onDecrypt,
  onRight,
  decryptDisabled,
}: ConversationBubbleProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const rowRef = useRef<HTMLDivElement>(null);
  const decrypted = isThreadItemDecrypted(item);

  useEffect(() => {
    if (highlighted) {
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlighted]);

  const copyTooltip =
    copyState === 'ok'
      ? 'Copied'
      : copyState === 'err'
        ? 'Copy failed'
        : 'Copy Encrypted JSON';

  const bubbleTooltip = (
    <Stack spacing={0.25} sx={{ py: 0.25 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {authorLabel}
      </Typography>
      <Typography variant="caption" component="div">
        Encrypted at: {formatEncryptionDate(item.encryptedAt)}
      </Typography>
      {item.decryptedAt !== undefined && (
        <Typography variant="caption" component="div">
          Decrypted at: {formatEncryptionDate(item.decryptedAt)}
        </Typography>
      )}
    </Stack>
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(item.encryptedPayload);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  }, [item.encryptedPayload]);

  return (
    <Box
      ref={rowRef}
      sx={{
        maxWidth: '90%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0.5,
          flexDirection: onRight ? 'row-reverse' : 'row',
          borderRadius: 2.5,
          outline: highlighted ? '2px solid' : 'none',
          outlineColor: 'warning.main',
          outlineOffset: 2,
          transition: 'outline-color 0.2s ease',
        }}
      >
        <Tooltip title={bubbleTooltip} enterDelay={400}>
          <Box
            sx={{
              px: 1.75,
              py: 1.25,
              borderRadius: 2.5,
              bgcolor: onRight ? 'primary.main' : 'grey.300',
              color: 'primary.contrastText',
              boxShadow: highlighted ? 6 : 1,
              cursor: 'default',
              transition: 'box-shadow 0.2s ease',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: decrypted ? undefined : 'monospace',
                fontSize: decrypted ? undefined : '0.8125rem',
              }}
            >
              {decrypted ? item.text : item.id}
            </Typography>
          </Box>
        </Tooltip>
        <Tooltip title={copyTooltip}>
          <span>
            <IconButton
              size="small"
              aria-label="Copy Encrypted JSON"
              onClick={() => void handleCopy()}
              color={copyState === 'ok' ? 'success' : 'default'}
              sx={{ mt: 0.25 }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {!decrypted && (
          <Tooltip title={decrypting ? 'Decrypting…' : 'Decrypt'}>
            <span>
              <IconButton
                size="small"
                aria-label="Decrypt"
                disabled={decrypting || decryptDisabled}
                onClick={onDecrypt}
                sx={{ mt: 0.25 }}
              >
                <LockOpenIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
      {decryptError && (
        <Typography
          variant="caption"
          color="error"
          sx={{ px: 0.5, alignSelf: onRight ? 'flex-end' : 'flex-start' }}
        >
          {decryptError}
        </Typography>
      )}
    </Box>
  );
}

export function OneToOneConversationThread({
  thread,
  viewerKeyId,
  currentUserLabel,
  peerLabel,
  highlightedMessageId = null,
  decryptingMessageId = null,
  decryptBusy = false,
  decryptErrorById = {},
  onDecryptMessage,
}: {
  thread: OneToOneThreadItem[];
  viewerKeyId: string | null;
  currentUserLabel: string;
  peerLabel: string;
  highlightedMessageId?: string | null;
  decryptingMessageId?: string | null;
  decryptBusy?: boolean;
  decryptErrorById?: Record<string, string | null>;
  onDecryptMessage: (item: OneToOneThreadItem) => void;
}) {
  const [animatedMessageIds, setAnimatedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [prevThreadLength, setPrevThreadLength] = useState(thread.length);

  if (thread.length === 0 && prevThreadLength !== 0) {
    setPrevThreadLength(0);
    setAnimatedMessageIds(new Set());
  } else if (thread.length !== prevThreadLength && thread.length > 0) {
    setPrevThreadLength(thread.length);
  }

  const handleAnimationDone = useCallback((messageId: string) => {
    setAnimatedMessageIds((prev) => {
      if (prev.has(messageId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
  }, []);

  if (thread.length === 0) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ py: 3, textAlign: 'center' }}
      >
        No messages yet. Encrypt a message to start the conversation.
      </Typography>
    );
  }

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      {thread.map((item, index) => {
        const onRight = isCurrentUserMessage(item, viewerKeyId);
        const animateEntry = !animatedMessageIds.has(item.id);

        return (
          <ConversationBubbleEnter
            key={item.id}
            messageId={item.id}
            animateEntry={animateEntry}
            staggerIndex={index}
            alignEnd={onRight}
            onAnimationDone={handleAnimationDone}
          >
            <ConversationBubble
              item={item}
              authorLabel={onRight ? currentUserLabel : peerLabel}
              highlighted={item.id === highlightedMessageId}
              decrypting={decryptingMessageId === item.id}
              decryptError={decryptErrorById[item.id] ?? null}
              onDecrypt={() => onDecryptMessage(item)}
              onRight={onRight}
              decryptDisabled={decryptBusy}
            />
          </ConversationBubbleEnter>
        );
      })}
    </Stack>
  );
}
