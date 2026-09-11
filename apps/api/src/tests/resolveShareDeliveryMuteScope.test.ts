import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FRIENDSHIP_MUTE_SCOPE_MESSAGES,
  FRIENDSHIP_MUTE_SCOPE_SHARES,
} from '@/contexts/friendships/domain/constants.js';
import { resolveShareDeliveryMuteScope } from '@/contexts/feed/application/shares/resolveShareDeliveryMuteScope.js';

const messageMocks = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const senderKeyMocks = vi.hoisted(() => ({
  getSenderKeyIdFromCorePayload: vi.fn(),
}));

vi.mock('@/contexts/feed/infrastructure/prismaMessageRepository.js', () => ({
  messageRepository: messageMocks,
}));

vi.mock('@encrypt/core/crypto/manifestDecrypt', () => ({
  getSenderKeyIdFromCorePayload: senderKeyMocks.getSenderKeyIdFromCorePayload,
}));

const authorKeyId = 'author-key-id';
const parentMessage = { version: 1 };

describe('resolveShareDeliveryMuteScope', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses messages mute scope when the sharer authored the parent message from wire payload', async () => {
    senderKeyMocks.getSenderKeyIdFromCorePayload.mockResolvedValue(authorKeyId);
    const scope = await resolveShareDeliveryMuteScope(
      authorKeyId,
      'msg-1',
      parentMessage,
    );

    expect(scope).toBe(FRIENDSHIP_MUTE_SCOPE_MESSAGES);
    expect(messageMocks.getById).not.toHaveBeenCalled();
  });

  it('uses shares mute scope when the sharer is not the parent author from wire payload', async () => {
    senderKeyMocks.getSenderKeyIdFromCorePayload.mockResolvedValue(authorKeyId);

    const scope = await resolveShareDeliveryMuteScope(
      'sharer-key-id',
      'msg-1',
      parentMessage,
    );

    expect(scope).toBe(FRIENDSHIP_MUTE_SCOPE_SHARES);
  });

  it('loads the parent sender from the DB when parentMessage is omitted', async () => {
    messageMocks.getById.mockResolvedValue({
      id: 'msg-1',
      payload: JSON.stringify(parentMessage),
      createdAt: Date.now(),
    });
    senderKeyMocks.getSenderKeyIdFromCorePayload.mockResolvedValue(authorKeyId);

    const scope = await resolveShareDeliveryMuteScope(authorKeyId, 'msg-1');

    expect(scope).toBe(FRIENDSHIP_MUTE_SCOPE_MESSAGES);
    expect(messageMocks.getById).toHaveBeenCalledWith('msg-1');
  });

  it('defaults to shares mute scope when the parent message is unknown', async () => {
    messageMocks.getById.mockResolvedValue(null);
    senderKeyMocks.getSenderKeyIdFromCorePayload.mockResolvedValue(null);

    const scope = await resolveShareDeliveryMuteScope(authorKeyId, 'msg-1');

    expect(scope).toBe(FRIENDSHIP_MUTE_SCOPE_SHARES);
  });
});
