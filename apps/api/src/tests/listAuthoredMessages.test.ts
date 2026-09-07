import { describe, expect, it, vi, beforeEach } from 'vitest';
import { handleListAuthoredMessages } from '@/contexts/feed/application/messages/queries/listAuthoredMessages/listAuthoredMessages.handler.js';
import { authoredMessagesRepository } from '@/contexts/feed/infrastructure/prismaAuthoredMessagesRepository.js';

vi.mock(
  '@/contexts/feed/infrastructure/prismaAuthoredMessagesRepository.js',
  () => ({
    authoredMessagesRepository: {
      listAuthoredMessages: vi.fn(),
    },
  }),
);

const senderPayload = JSON.stringify({
  version: 1,
  wrap: 'manifest-v1',
  senderPublicJwk: {
    kty: 'EC',
    crv: 'P-256',
    x: 'sender-x',
    y: 'sender-y',
  },
  ephemeralPublicKey: { kty: 'EC', crv: 'P-256', x: 'e-x', y: 'e-y' },
  encryptedContent: { iv: 'iv', ciphertext: 'cipher' },
  senderSignature: 'sig',
});

const manifestEntryJson = JSON.stringify({
  keyId: 'author-key-id',
  iv: 'iv',
  salt: 'salt',
  encryptedDek: 'dek',
});

describe('handleListAuthoredMessages', () => {
  beforeEach(() => {
    vi.mocked(authoredMessagesRepository.listAuthoredMessages).mockReset();
  });

  it('returns authored messages with manifest shards from a single repository call', async () => {
    vi.mocked(
      authoredMessagesRepository.listAuthoredMessages,
    ).mockResolvedValue({
      messages: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          payload: senderPayload,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          manifestEntryJson,
        },
      ],
      nextCursor: null,
    });

    const result = await handleListAuthoredMessages({
      authorKeyId: 'author-key-id',
      limit: 10,
      sort: 'date',
      order: 'desc',
      before: '2026-06-01T00:00:00.000Z',
    });

    expect(
      authoredMessagesRepository.listAuthoredMessages,
    ).toHaveBeenCalledWith({
      authorKeyId: 'author-key-id',
      limit: 10,
      cursor: undefined,
      order: 'desc',
      before: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(result.items[0]?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(result.items[0]?.type).toBe('message');
    expect(result.items[0]?.keyManifest).toEqual({
      'author-key-id': {
        keyId: 'author-key-id',
        iv: 'iv',
        salt: 'salt',
        encryptedDek: 'dek',
      },
    });
  });
});
