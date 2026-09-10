import { describe, expect, it } from 'vitest';
import { filterKeyManifestToFriends } from '@/contexts/feed/application/messages/filterKeyManifestToFriends.js';

const shard = {
  keyId: 'placeholder',
  iv: 'iv',
  salt: 'salt',
  encryptedDek: 'dek',
};

describe('filterKeyManifestToFriends', () => {
  it('requires the sender in the POST keyManifest', () => {
    expect(() =>
      filterKeyManifestToFriends(
        {
          friend: { ...shard, keyId: 'friend' },
        },
        'sender',
        new Set(['friend']),
      ),
    ).toThrow('keyManifest must include the sender.');
  });

  it('keeps a sender-only manifest when the sender has no friends', () => {
    const result = filterKeyManifestToFriends(
      {
        sender: { ...shard, keyId: 'sender' },
      },
      'sender',
      new Set(),
    );

    expect(Object.keys(result)).toEqual(['sender']);
  });

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
