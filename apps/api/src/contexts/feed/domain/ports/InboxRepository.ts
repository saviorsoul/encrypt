export type InboxSort = 'shareTime' | 'originalDate' | 'lastComment';
export type InboxOrder = 'asc' | 'desc';

export type InboxCursor = {
  sortAt: Date;
  threadId: string;
};

export type InboxPageThread = {
  threadId: string;
  sortAt: Date;
  shareId: string | null;
  entryJson: string;
  messagePayload: string;
  messageCreatedAt: Date;
  messageLastCommentAt: Date | null;
  sharePayload: string | null;
  shareCreatedAt: Date | null;
};

export type ListInboxDeliveriesQuery = {
  recipientKeyId: string;
  limit: number;
  cursor?: InboxCursor;
  sort: InboxSort;
  order: InboxOrder;
};

export type ListInboxDeliveriesResult = {
  threads: InboxPageThread[];
  nextCursor: InboxCursor | null;
  total: number;
};

export interface InboxRepository {
  listDeliveries(
    query: ListInboxDeliveriesQuery,
  ): Promise<ListInboxDeliveriesResult>;
}
