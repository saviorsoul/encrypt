import type {
  InboxOrder,
  InboxSort,
} from '@/contexts/feed/domain/ports/InboxRepository.js';

export type ListInboxQuery = {
  recipientKeyId: string;
  limit: number;
  cursor?: string;
  sort: InboxSort;
  order: InboxOrder;
};
