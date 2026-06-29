import type { Middleware } from 'koa';
import {
  verifyCommentSignature,
  verifyManifestShareSignature,
  verifyManifestSignature,
} from '../crypto/signatures.js';
import { badRequest } from '../lib/httpError.js';

export type SignatureType = 'sender' | 'sharer' | 'comment-sender';

type VerifySignatureOptions = {
  /** Dot path into ctx.request.body; defaults per signature type. */
  bodyPath?: string;
  /** When true, skip verification if the target field is absent. */
  optional?: boolean;
};

const defaultBodyPath: Record<SignatureType, string> = {
  sharer: 'share',
  sender: '',
  'comment-sender': '',
};

function readBodyPath(body: unknown, path: string): unknown {
  if (!path) {
    return body;
  }

  let current: unknown = body;
  for (const segment of path.split('.')) {
    if (
      current === null ||
      typeof current !== 'object' ||
      !(segment in (current as Record<string, unknown>))
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

async function verifyPayload(
  type: SignatureType,
  payload: unknown,
): Promise<void> {
  switch (type) {
    case 'sharer':
      await verifyManifestShareSignature(
        payload as Parameters<typeof verifyManifestShareSignature>[0],
      );
      return;
    case 'sender':
      await verifyManifestSignature(
        payload as Parameters<typeof verifyManifestSignature>[0],
      );
      return;
    case 'comment-sender':
      await verifyCommentSignature(
        payload as Parameters<typeof verifyCommentSignature>[0],
      );
      return;
    default: {
      const exhaustive: never = type;
      throw badRequest(`Unsupported signature type: ${String(exhaustive)}`);
    }
  }
}

export function verifySignature(
  type: SignatureType,
  options: VerifySignatureOptions = {},
): Middleware {
  const bodyPath = options.bodyPath ?? defaultBodyPath[type];

  return async (ctx, next) => {
    const payload = readBodyPath(ctx.request.body, bodyPath);

    if (payload === undefined) {
      if (options.optional) {
        await next();
        return;
      }
      throw badRequest(`Missing signed payload at "${bodyPath || '(root)'}".`);
    }

    try {
      await verifyPayload(type, payload);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Signature verification failed.';
      throw badRequest(message);
    }

    await next();
  };
}
