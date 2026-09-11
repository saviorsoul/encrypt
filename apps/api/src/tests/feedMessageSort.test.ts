import { describe, expect, it } from 'vitest';
import {
  getViewerReceivedAt,
  sortFeedMessages,
} from '@encrypt/core/utils/feedMessageSort';
import type {
  StoredFeedDelivery,
  StoredMessage,
} from '@encrypt/core/feed/types';

const viewerKeyId = 'viewer-key-id';

function message(
  id: string,
  createdAt: number,
  lastCommentAt?: number | null,
): StoredMessage {
  return {
    id,
    payload: `payload-${id}`,
    createdAt,
    lastCommentAt,
  };
}

function share(
  id: string,
  messageId: string,
  createdAt: number,
): StoredFeedDelivery {
  return {
    id,
    messageId,
    payload: `share-${id}`,
    createdAt,
  };
}

describe('getViewerReceivedAt', () => {
  it('uses original message date for direct manifest access', () => {
    const parent = message('parent-1', 100);
    const receivedAt = getViewerReceivedAt(
      [parent, share('share-1', 'parent-1', 500)],
      viewerKeyId,
      (messageId, keyId) =>
        messageId === 'parent-1' && keyId === viewerKeyId
          ? { keyId, iv: 'iv', salt: 'salt', encryptedDek: 'dek' }
          : null,
    );

    expect(receivedAt).toBe(100);
  });

  it('uses share delivery date when access is share-only', () => {
    const parent = message('parent-1', 100);
    const receivedAt = getViewerReceivedAt(
      [parent, share('share-1', 'parent-1', 500)],
      viewerKeyId,
      () => null,
    );

    expect(receivedAt).toBe(500);
  });
});

describe('sortFeedMessages', () => {
  const manifestLookup = (
    messageId: string,
    keyId: string,
  ): {
    keyId: string;
    iv: string;
    salt: string;
    encryptedDek: string;
  } | null =>
    messageId === 'direct-1' && keyId === viewerKeyId
      ? { keyId, iv: 'iv', salt: 'salt', encryptedDek: 'dek' }
      : null;

  it('sorts by original date descending', () => {
    const messages = [
      message('older', 100),
      message('newer', 300),
      message('middle', 200),
    ];

    const sorted = sortFeedMessages({
      messages,
      allDeliveries: messages,
      viewerKeyId,
      manifestLookup,
      mode: 'originalDate',
    });

    expect(sorted.map((row) => row.id)).toEqual(['newer', 'middle', 'older']);
  });

  it('sorts by share time using share delivery for share-only access', () => {
    const direct = message('direct-1', 1000);
    const sharedParent = message('shared-parent', 100);
    const deliveries: StoredFeedDelivery[] = [
      direct,
      sharedParent,
      share('share-1', 'shared-parent', 800),
    ];

    const sorted = sortFeedMessages({
      messages: [direct, sharedParent],
      allDeliveries: deliveries,
      viewerKeyId,
      manifestLookup,
      mode: 'shareTime',
    });

    expect(sorted.map((row) => row.id)).toEqual(['direct-1', 'shared-parent']);
  });

  it('sorts by last comment date and puts threads without comments last', () => {
    const messages = [
      message('no-comments', 100),
      message('recent-comment', 50, 500),
      message('older-comment', 200, 300),
    ];

    const sorted = sortFeedMessages({
      messages,
      allDeliveries: messages,
      viewerKeyId,
      manifestLookup,
      mode: 'lastComment',
    });

    expect(sorted.map((row) => row.id)).toEqual([
      'recent-comment',
      'older-comment',
      'no-comments',
    ]);
  });

  it('applies optimistic last comment overrides', () => {
    const messages = [message('a', 100, 200), message('b', 100, 100)];

    const sorted = sortFeedMessages({
      messages,
      allDeliveries: messages,
      viewerKeyId,
      manifestLookup,
      mode: 'lastComment',
      lastCommentOverrides: new Map([['b', 900]]),
    });

    expect(sorted.map((row) => row.id)).toEqual(['b', 'a']);
  });
});
