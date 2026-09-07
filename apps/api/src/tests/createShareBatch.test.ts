import { describe, expect, it, vi, beforeEach } from 'vitest';
import { handleCreateShareBatch } from '@/contexts/feed/application/shares/commands/createShareBatch/createShareBatch.handler.js';
import { handleCreateShare } from '@/contexts/feed/application/shares/commands/createShare/createShare.handler.js';

vi.mock(
  '@/contexts/feed/application/shares/commands/createShare/createShare.handler.js',
  () => ({
    handleCreateShare: vi.fn(),
  }),
);

describe('handleCreateShareBatch', () => {
  beforeEach(() => {
    vi.mocked(handleCreateShare).mockReset();
  });

  it('creates each share and returns per-item results', async () => {
    vi.mocked(handleCreateShare)
      .mockResolvedValueOnce({ id: 'share-1' })
      .mockResolvedValueOnce({ recipientsAlreadyHadAccess: true });

    const result = await handleCreateShareBatch({
      senderKeyId: 'owner-key-id',
      shares: [
        {
          share: {
            parentMessageId: 'msg-1',
          },
          keyManifest: {},
        },
        {
          share: {
            parentMessageId: 'msg-2',
          },
          keyManifest: {},
        },
      ],
    });

    expect(result.results).toEqual([
      { parentMessageId: 'msg-1', id: 'share-1' },
      { parentMessageId: 'msg-2', recipientsAlreadyHadAccess: true },
    ]);
    expect(handleCreateShare).toHaveBeenCalledTimes(2);
  });
});
