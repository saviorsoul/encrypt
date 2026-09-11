import type {
  InboxOrder,
  InboxSort,
} from '@/contexts/feed/domain/ports/InboxRepository.js';

export type ListInboxQuery = {
  recipientKeyId: string;
  limit: number;
  cursorSortAt?: string;
  cursorThreadId?: string;
  sort: InboxSort;
  order: InboxOrder;
};
