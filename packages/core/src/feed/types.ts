export type StoredMessage = {
  id: string;
  payload: string;
  createdAt: number;
};

export type StoredShare = {
  id: string;
  messageId: string;
  payload: string;
  createdAt: number;
};

export type StoredFeedDelivery = StoredMessage | StoredShare;

export type StoredComment = {
  id: string;
  messageId: string;
  payload: string;
  createdAt: number;
};

/** API inbox row — key manifest shard included for decrypt. */
export type InboxApiItem = {
  id: string;
  type: 'message' | 'share';
  /** Thread root id for share deliveries. */
  messageId?: string;
  payload: string;
  createdAt: string;
  keyManifest: Record<
    string,
    {
      keyId: string;
      publicKey?: JsonWebKey;
      iv: string;
      salt: string;
      encryptedDek: string;
    }
  >;
};

export function inboxApiItemToStoredDelivery(
  item: InboxApiItem,
): StoredFeedDelivery {
  const createdAt = Date.parse(item.createdAt);
  if (item.type === 'share') {
    return {
      id: item.id,
      messageId: item.messageId ?? item.id,
      payload: item.payload,
      createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    };
  }
  return {
    id: item.id,
    payload: item.payload,
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
  };
}

export function inboxApiItemsToStoredDeliveries(
  items: InboxApiItem[],
): StoredFeedDelivery[] {
  return items.map(inboxApiItemToStoredDelivery);
}

export function apiCommentToStoredComment(row: {
  id: string;
  messageId: string;
  payload: string;
  createdAt: string;
}): StoredComment {
  const createdAt = Date.parse(row.createdAt);
  return {
    id: row.id,
    messageId: row.messageId,
    payload: row.payload,
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
  };
}
