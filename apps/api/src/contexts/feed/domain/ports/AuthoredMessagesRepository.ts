import type { InboxOrder } from './InboxRepository.js';

export type AuthoredMessageRow = {
  id: string;
  payload: string;
  createdAt: Date;
  manifestEntryJson: string;
};

export type ListAuthoredMessagesResult = {
  messages: AuthoredMessageRow[];
  nextCursor: string | null;
};

export interface AuthoredMessagesRepository {
  listAuthoredMessages(params: {
    authorKeyId: string;
    limit: number;
    cursor?: string;
    order: InboxOrder;
    before?: Date;
  }): Promise<ListAuthoredMessagesResult>;
}
