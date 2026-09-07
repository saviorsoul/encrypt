import type {
  InboxOrder,
  InboxSort,
} from '@/contexts/feed/domain/ports/InboxRepository.js';

export type ListAuthoredMessagesQuery = {
  authorKeyId: string;
  limit: number;
  cursor?: string;
  sort: InboxSort;
  order: InboxOrder;
  before?: string;
};
