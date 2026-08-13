export type InboxSort = 'date';
export type InboxOrder = 'asc' | 'desc';

export type InboxDeliveryRef = {
  id: string;
  createdAt: Date;
  kind: 'message' | 'share';
};

export type ListInboxDeliveriesQuery = {
  recipientKeyId: string;
  limit: number;
  cursor?: string;
  sort: InboxSort;
  order: InboxOrder;
};

export type ListInboxDeliveriesResult = {
  deliveries: InboxDeliveryRef[];
  nextCursor: string | null;
};

export interface InboxRepository {
  countDeliveries(
    query: Pick<ListInboxDeliveriesQuery, 'recipientKeyId' | 'sort' | 'order'>,
  ): Promise<number>;
  listDeliveries(
    query: ListInboxDeliveriesQuery,
  ): Promise<ListInboxDeliveriesResult>;
  recipientHasShareAccessToParent(
    parentMessageId: string,
    recipientKeyId: string,
  ): Promise<boolean>;
}
