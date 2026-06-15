import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { OneToOneMessageBubblePopover } from '@/components/one-to-one/OneToOneMessageBubblePopover.tsx';
import {
  isThreadItemDecrypted,
  type OneToOneThreadItem,
} from '@/types/oneToOne.ts';
import type { CopyState } from '@/types/copyState.ts';
import { downloadTextFile } from '@/utils/downloadJson.ts';
import { oneToOneMessageExportFilename } from '@/utils/oneToOneMessageExportFilename.ts';
import { prettifyJsonText } from '@/utils/prettifyJsonText.ts';

const MESSAGE_ENTER = 'oneToOneMessageEnter';
const MESSAGE_ENTER_MS = 360;
const MESSAGE_STAGGER_MS = 90;

const messageActionIconButtonSx = {
  p: 0,
  fontSize: '1.125rem',
  lineHeight: 1,
  borderRadius: 1,
  transition: 'color 0.15s ease, transform 0.1s ease',
  '&:hover': {
    color: 'primary.main',
  },
  '&:focus-visible': {
    color: 'primary.main',
  },
  '&:active': {
    color: 'primary.main',
    transform: 'scale(0.9)',
  },
};

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

type ConversationBubbleProps = {
  item: OneToOneThreadItem;
  authorLabel: string;
  currentUserLabel: string;
  peerLabel: string;
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
  currentUserLabel,
  peerLabel,
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

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        prettifyJsonText(item.encryptedPayload),
      );
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  }, [item.encryptedPayload]);

  const handleExport = useCallback(() => {
    const exportNameLabel = onRight ? currentUserLabel : peerLabel;
    downloadTextFile(
      prettifyJsonText(item.encryptedPayload),
      oneToOneMessageExportFilename(item.encryptedAt, exportNameLabel),
    );
  }, [
    currentUserLabel,
    item.encryptedAt,
    item.encryptedPayload,
    onRight,
    peerLabel,
  ]);

  const messageActions = (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
      <IconButton
        aria-label={
          copyState === 'ok'
            ? 'Copied'
            : copyState === 'err'
              ? 'Copy failed'
              : 'Copy Encrypted JSON'
        }
        onClick={() => void handleCopy()}
        color={copyState === 'ok' ? 'success' : 'inherit'}
        sx={messageActionIconButtonSx}
      >
        <ContentCopyIcon fontSize="inherit" />
      </IconButton>

      <IconButton
        aria-label="Export message to file"
        onClick={handleExport}
        color="inherit"
        sx={messageActionIconButtonSx}
      >
        <FileDownloadOutlinedIcon fontSize="inherit" />
      </IconButton>
      {!decrypted && (
        <IconButton
          aria-label={decrypting ? 'Decrypting…' : 'Decrypt'}
          disabled={decrypting || decryptDisabled}
          onClick={onDecrypt}
          color="inherit"
          sx={messageActionIconButtonSx}
        >
          <LockOpenIcon fontSize="inherit" />
        </IconButton>
      )}
    </Stack>
  );

  return (
    <Box
      ref={rowRef}
      sx={{
        maxWidth: '90%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        alignItems: onRight ? 'flex-end' : 'flex-start',
      }}
    >
      <OneToOneMessageBubblePopover
        messageId={item.id}
        authorLabel={authorLabel}
        alignEnd={onRight}
        highlighted={highlighted}
        actions={messageActions}
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
      </OneToOneMessageBubblePopover>
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
              currentUserLabel={currentUserLabel}
              peerLabel={peerLabel}
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
