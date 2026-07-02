import type { KeyManifestMap } from '../types/manifest.ts';
import type { InboxApiItem, StoredComment } from '../feed/types.ts';
import {
  type FeedApiAuthProvider,
  type FeedApiPerRequestAuth,
  resolveAuthHeaderRecord,
} from './feedApiAuth.ts';
import { buildAuthRequestDescriptorFromParts } from '../crypto/authProof.ts';

export type {
  FeedApiAuthProvider,
  FeedApiPerRequestAuth,
} from './feedApiAuth.ts';
export {
  createFeedApiAuthProvider,
  clearFeedApiAuthHeaderCache,
} from './feedApiAuth.ts';

export type FeedApiConfig = {
  baseUrl: string;
  fetch?: typeof fetch;
  auth?: FeedApiAuthProvider;
};

export type FeedApiRequestOptions = {
  auth?: FeedApiPerRequestAuth;
};

export type RegisterUserRequest = {
  publicKey: string | { x: string; y: string };
};

export type BackendUser = {
  keyId: string;
  publicKey: { x: string; y: string };
};

export type CreateShareRequest = {
  share: Record<string, unknown>;
  keyManifest: KeyManifestMap;
  messageId?: string;
};

export type CreateMessageRequest = {
  version: number;
  wrap: string;
  senderPublicJwk: Record<string, unknown>;
  ephemeralPublicKey: Record<string, unknown>;
  encryptedContent: Record<string, unknown>;
  senderSignature: string;
  keyManifest: KeyManifestMap;
};

export type FriendshipRequest = {
  requesterKeyId: string;
  targetKeyId: string;
  status: 'pending' | 'rejected';
  createdAt: string;
  updatedAt: string;
};

export type Friendship = {
  friendKeyId: string;
  publicKey: { x: string; y: string };
  createdAt: string;
};

export type CreateFriendshipRequestResult =
  | { status: 'pending'; request: FriendshipRequest }
  | { status: 'accepted' };

export type FriendshipRequests = {
  incoming: FriendshipRequest[];
  outgoing: FriendshipRequest[];
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body.error === 'string' && body.error) {
      return body.error;
    }
  } catch {
    // ignore JSON parse errors
  }
  return `Request failed (${response.status}).`;
}

export function createFeedApi(config: FeedApiConfig) {
  const http = config.fetch ?? fetch;
  const baseUrl = config.baseUrl;
  const auth = config.auth;

  async function authHeaders(
    method: string,
    url: string,
    body?: BodyInit | null,
    options?: FeedApiRequestOptions,
  ): Promise<Record<string, string>> {
    const request = buildAuthRequestDescriptorFromParts(method, url, body);
    return resolveAuthHeaderRecord(auth, request, options?.auth);
  }

  async function authorizedFetch(
    path: string,
    init: RequestInit,
    options?: FeedApiRequestOptions,
  ): Promise<Response> {
    const url = joinUrl(baseUrl, path);
    const method = (init.method ?? 'GET').toUpperCase();
    const proof = await authHeaders(method, url, init.body, options);
    const headers = new Headers(init.headers);
    for (const [name, value] of Object.entries(proof)) {
      headers.set(name, value);
    }
    return http(url, { ...init, headers });
  }

  async function authorizedFetchUrl(
    url: string,
    init: RequestInit,
    options?: FeedApiRequestOptions,
  ): Promise<Response> {
    const method = (init.method ?? 'GET').toUpperCase();
    const proof = await authHeaders(method, url, init.body, options);
    const headers = new Headers(init.headers);
    for (const [name, value] of Object.entries(proof)) {
      headers.set(name, value);
    }
    return http(url, { ...init, headers });
  }

  return {
    async getHealth(): Promise<{ status: string }> {
      const response = await http(joinUrl(baseUrl, '/health'));
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { status: string };
    },

    async getInbox(): Promise<InboxApiItem[]> {
      const response = await authorizedFetchUrl(
        joinUrl(baseUrl, '/api/inbox'),
        {},
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as InboxApiItem[];
    },

    async getUsers(): Promise<BackendUser[]> {
      const response = await authorizedFetchUrl(
        joinUrl(baseUrl, '/api/users'),
        {},
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as BackendUser[];
    },

    async postUser(
      body: RegisterUserRequest,
      options?: FeedApiRequestOptions,
    ): Promise<{ keyId: string }> {
      const response = await authorizedFetch(
        '/api/users',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        options,
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { keyId: string };
    },

    async postMessage(body: CreateMessageRequest): Promise<{ id: string }> {
      const response = await authorizedFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { id: string };
    },

    async postShare(body: CreateShareRequest): Promise<{ id: string }> {
      const response = await authorizedFetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { id: string };
    },

    /** POST raw JSON text without client-side parsing (feed-lab / API testing). */
    async postImportBody(
      path: '/api/messages' | '/api/shares' | '/api/comments',
      body: string,
    ): Promise<{ id: string }> {
      const response = await authorizedFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { id: string };
    },

    async getComments(messageId: string): Promise<StoredComment[]> {
      const url = new URL(joinUrl(baseUrl, '/api/comments'));
      url.searchParams.set('messageId', messageId);
      const response = await authorizedFetchUrl(url.toString(), {});
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const rows = (await response.json()) as Array<{
        id: string;
        messageId: string;
        payload: string;
        createdAt: string;
      }>;
      return rows.map((row) => ({
        id: row.id,
        messageId: row.messageId,
        payload: row.payload,
        createdAt: Date.parse(row.createdAt) || Date.now(),
      }));
    },

    async postComment(
      payload: Record<string, unknown>,
    ): Promise<{ id: string }> {
      const response = await authorizedFetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { id: string };
    },

    async postFriendshipRequest(body: {
      targetKeyId: string;
    }): Promise<CreateFriendshipRequestResult> {
      const response = await authorizedFetch('/api/friendships/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as CreateFriendshipRequestResult;
    },

    async getFriendshipRequests(): Promise<FriendshipRequests> {
      const response = await authorizedFetchUrl(
        joinUrl(baseUrl, '/api/friendships/requests'),
        {},
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as FriendshipRequests;
    },

    async acceptFriendshipRequest(body: {
      requesterKeyId: string;
    }): Promise<{ status: 'accepted' }> {
      const response = await authorizedFetch(
        '/api/friendships/requests/accept',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { status: 'accepted' };
    },

    async rejectFriendshipRequest(body: {
      requesterKeyId: string;
    }): Promise<FriendshipRequest> {
      const response = await authorizedFetch(
        '/api/friendships/requests/reject',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as FriendshipRequest;
    },

    async getFriendships(): Promise<Friendship[]> {
      const response = await authorizedFetchUrl(
        joinUrl(baseUrl, '/api/friendships'),
        {},
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as Friendship[];
    },

    async deleteFriendship(body: { friendKeyId: string }): Promise<void> {
      const response = await authorizedFetch('/api/friendships', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
    },

    /** Inbox rows plus comments for each visible thread root. */
    async getAllFeedData(): Promise<{
      inbox: InboxApiItem[];
      commentsByMessageId: Record<string, StoredComment[]>;
    }> {
      const inbox = await this.getInbox();
      const threadIds = [
        ...new Set(
          inbox.map((item) =>
            item.type === 'share' ? (item.messageId ?? item.id) : item.id,
          ),
        ),
      ];
      const commentsByMessageId: Record<string, StoredComment[]> = {};
      await Promise.all(
        threadIds.map(async (messageId) => {
          commentsByMessageId[messageId] = await this.getComments(messageId);
        }),
      );
      return { inbox, commentsByMessageId };
    },
  };
}

export type FeedApi = ReturnType<typeof createFeedApi>;
