import type { KeyManifestMap } from '../types/manifest.ts';
import type { InboxApiItem, StoredComment } from '../feed/types.ts';
import {
  type FeedApiAuthProvider,
  type FeedApiPerRequestAuth,
  type FeedApiAuthHeaderOptions,
  resolveAuthHeaderRecord,
  captureFeedApiNextNonce,
} from './feedApiAuth.ts';
import { buildAuthRequestDescriptorFromParts } from '../crypto/authProof.ts';

export type {
  FeedApiAuthProvider,
  FeedApiPerRequestAuth,
  FeedApiAuthHeaderOptions,
} from './feedApiAuth.ts';
export {
  createFeedApiAuthProvider,
  clearFeedApiAuthState,
  releaseFeedApiAuthKeySwitch,
  captureFeedApiNextNonce,
  handleFeedApiAuthStorageEvent,
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
  const authConfig = {
    challengeUrl: joinUrl(baseUrl, '/api/auth/challenge'),
    fetch: http,
  };

  async function authHeaders(
    method: string,
    url: string,
    body?: BodyInit | null,
    options?: FeedApiRequestOptions & FeedApiAuthHeaderOptions,
  ): Promise<Record<string, string>> {
    const request = buildAuthRequestDescriptorFromParts(method, url, body);
    return resolveAuthHeaderRecord(
      authConfig,
      request,
      { auth, perRequest: options?.auth },
      { bypassClientNonceCache: options?.bypassClientNonceCache },
    );
  }

  async function sendAuthorized(
    url: string,
    init: RequestInit,
    options?: FeedApiRequestOptions,
  ): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const method = (init.method ?? 'GET').toUpperCase();
      const proof = await authHeaders(method, url, init.body, {
        ...options,
        bypassClientNonceCache: attempt > 0,
      });
      const headers = new Headers(init.headers);
      for (const [name, value] of Object.entries(proof)) {
        headers.set(name, value);
      }
      const response = await http(url, { ...init, headers });
      const keyId = proof['X-Key-Id'];
      if (keyId) {
        if (auth) {
          auth.captureNextNonceFromResponse(keyId, response);
        } else {
          captureFeedApiNextNonce(keyId, response);
        }
      }
      if (response.status === 401 && attempt === 0) {
        continue;
      }
      return response;
    }
    throw new Error('Authentication failed after retry.');
  }

  async function authorizedFetch(
    path: string,
    init: RequestInit,
    options?: FeedApiRequestOptions,
  ): Promise<Response> {
    return sendAuthorized(joinUrl(baseUrl, path), init, options);
  }

  async function authorizedFetchUrl(
    url: string,
    init: RequestInit,
    options?: FeedApiRequestOptions,
  ): Promise<Response> {
    return sendAuthorized(url, init, options);
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
  };
}

export type FeedApi = ReturnType<typeof createFeedApi>;
