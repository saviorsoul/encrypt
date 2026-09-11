import type { QuerySchemaName } from './common.js';

export type CommentsQuery = {
  messageId: string;
};

export type InboxQuery = {
  limit: number;
  cursorSortAt?: string;
  cursorThreadId?: string;
  sort: 'shareTime' | 'originalDate' | 'lastComment';
  order: 'asc' | 'desc';
};

export type AuthoredMessagesQuery = InboxQuery & {
  before?: string;
};

export type ValidatedQueryMap = {
  commentsQuery: CommentsQuery;
  inboxQuery: InboxQuery;
  authoredMessagesQuery: AuthoredMessagesQuery;
};

export type ValidatedQueryFor<T extends QuerySchemaName> = ValidatedQueryMap[T];
