import { describe, expect, it } from 'vitest';
import { filterKeyManifestToFriends } from '@/contexts/feed/application/messages/filterKeyManifestToFriends.js';

const shard = {
  keyId: 'placeholder',
  iv: 'iv',
  salt: 'salt',
  encryptedDek: 'dek',
};

describe('filterKeyManifestToFriends', () => {
  it('keeps the sender and DB friends, omits anyone else in the POST', () => {
    const result = filterKeyManifestToFriends(
      {
        sender: { ...shard, keyId: 'sender' },
        friend: { ...shard, keyId: 'friend' },
        stranger: { ...shard, keyId: 'stranger' },
      },
      'sender',
      new Set(['friend']),
    );

    expect(Object.keys(result).sort()).toEqual(['friend', 'sender']);
  });
});
