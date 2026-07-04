import { bytesToBase64, base64ToBytes } from '../utils/bytes.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from './jwkThumbprint.ts';
import { ecPublicJwkFromCoords } from './ecPublicKey.ts';
import {
  signCanonicalBody,
  serializeForSigning,
  verifyCanonicalSignature,
} from './manifestSign.ts';

export const AUTH_SIGNABLE_VERSION = 2;
export const AUTH_TIME_SLOT_SECONDS = 30;
/** Accepted client slots: serverSlot ± AUTH_TIME_SLOT_SKEW */
export const AUTH_TIME_SLOT_SKEW = 1;
export const AUTH_NONCE_TTL_SECONDS = 15 * 60;
/** Re-bootstrap when fewer than this many seconds remain before server/client nonce expiry. */
export const AUTH_NONCE_MIN_REMAINING_SECONDS = 30;
/** Random auth nonce length in bytes (wire form is standard base64, like manifest IVs). */
export const AUTH_NONCE_BYTES = 12;

export const AUTH_HEADER_KEY_ID = 'X-Key-Id';
export const AUTH_HEADER_PUBLIC_KEY = 'X-Public-Key';
export const AUTH_HEADER_TIME_SLOT = 'X-Time-Slot';
export const AUTH_HEADER_NONCE = 'X-Nonce';
export const AUTH_HEADER_NEXT_NONCE = 'X-Next-Nonce';
export const AUTH_HEADER_NEXT_NONCE_EXPIRES_AT = 'X-Next-Nonce-Expires-At';
export const AUTH_HEADER_SIGNATURE = 'X-Signature';

export type AuthPublicKeyCoords = { x: string; y: string };

/** Wire form for `X-Public-Key` header (`x;y`, same convention as user registration). */
export function formatAuthPublicKeyWire(
  publicKey: AuthPublicKeyCoords,
): string {
  return `${publicKey.x};${publicKey.y}`;
}

export function parseAuthPublicKeyWire(wire: string): AuthPublicKeyCoords {
  const semicolon = wire.indexOf(';');
  if (semicolon <= 0) {
    throw new Error('X-Public-Key must be x;y coordinates.');
  }
  const x = wire.slice(0, semicolon).trim();
  const y = wire.slice(semicolon + 1).trim();
  if (!x || !y) {
    throw new Error('X-Public-Key must be x;y coordinates.');
  }
  return { x, y };
}

export async function assertAuthKeyIdMatchesPublicKey(
  keyId: string,
  publicKey: AuthPublicKeyCoords,
): Promise<void> {
  const expectedKeyId = await ecPublicJwkThumbprintSha256(
    slimEcPublicJwk(ecPublicJwkFromCoords(publicKey)),
  );
  if (keyId !== expectedKeyId) {
    throw new Error('keyId does not match X-Public-Key thumbprint.');
  }
}

export type AuthRequestDescriptor = {
  method: string;
  path: string;
  query?: Record<string, string> | null;
  body?: unknown;
};

export type AuthProofContext = {
  timeSlot: number;
  nonce: string;
};

export type AuthSignableGetBody = {
  v: typeof AUTH_SIGNABLE_VERSION;
  keyId: string;
  method: string;
  path: string;
  query: Record<string, string> | null;
  timeSlot: number;
  nonce: string;
};

export type AuthSignableMutationBody = AuthSignableGetBody & {
  bodyHash: string;
};

export type AuthSignableBody = AuthSignableGetBody | AuthSignableMutationBody;

export function authSignableIncludesBodyHash(method: string): boolean {
  const normalized = method.toUpperCase();
  return normalized === 'POST' || normalized === 'DELETE';
}

export function computeAuthTimeSlot(
  unixSeconds = Math.floor(Date.now() / 1000),
): number {
  return Math.floor(unixSeconds / AUTH_TIME_SLOT_SECONDS);
}

export function canonicalizeAuthQuery(
  query: Record<string, unknown> | URLSearchParams | null | undefined,
): Record<string, string> | null {
  const entries: Array<[string, string]> = [];

  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => {
      entries.push([key, value]);
    });
  } else if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        if (value[0] !== undefined) {
          entries.push([key, String(value[0])]);
        }
        continue;
      }
      entries.push([key, String(value)]);
    }
  }

  entries.sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries);
}

export function parseAuthRequestBodyInit(
  body: BodyInit | null | undefined,
): unknown {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === 'string') {
    if (!body.trim()) {
      return undefined;
    }
    return JSON.parse(body) as unknown;
  }
  throw new Error('Unsupported request body type for API auth.');
}

export function buildAuthRequestDescriptorFromParts(
  method: string,
  url: string | URL,
  body?: BodyInit | null | undefined,
): AuthRequestDescriptor {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  return {
    method: method.toUpperCase(),
    path: parsed.pathname,
    query: canonicalizeAuthQuery(parsed.searchParams),
    body: parseAuthRequestBodyInit(body),
  };
}

export function buildAuthRequestDescriptorFromContext(ctx: {
  method: string;
  path: string;
  query: Record<string, unknown>;
  request: { body?: unknown };
}): AuthRequestDescriptor {
  return {
    method: ctx.method.toUpperCase(),
    path: ctx.path,
    query: canonicalizeAuthQuery(ctx.query),
    body: ctx.request.body,
  };
}

export async function hashAuthRequestBody(
  body: unknown,
): Promise<string | null> {
  if (body === undefined || body === null) {
    return null;
  }
  if (typeof body === 'string') {
    if (!body.trim()) {
      return null;
    }
    return hashAuthRequestBody(JSON.parse(body) as unknown);
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Auth request body must be a JSON object.');
  }

  const bytes = serializeForSigning(body as Record<string, unknown>);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToBase64(new Uint8Array(digest));
}

export async function buildAuthSignable(
  keyId: string,
  proof: AuthProofContext,
  request: AuthRequestDescriptor,
): Promise<AuthSignableBody> {
  const base: AuthSignableGetBody = {
    v: AUTH_SIGNABLE_VERSION,
    keyId,
    method: request.method.toUpperCase(),
    path: request.path,
    query: request.query ?? null,
    timeSlot: proof.timeSlot,
    nonce: proof.nonce,
  };

  if (!authSignableIncludesBodyHash(request.method)) {
    return base;
  }

  const bodyHash = await hashAuthRequestBody(request.body);
  if (!bodyHash) {
    throw new Error(
      `${request.method.toUpperCase()} requests require a JSON body for authentication.`,
    );
  }

  return { ...base, bodyHash };
}

export function isAuthTimeSlotAccepted(
  clientTimeSlot: number,
  unixSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!Number.isInteger(clientTimeSlot) || clientTimeSlot < 0) {
    return false;
  }
  const serverSlot = computeAuthTimeSlot(unixSeconds);
  return Math.abs(clientTimeSlot - serverSlot) <= AUTH_TIME_SLOT_SKEW;
}

export function parseAuthNonceExpiresAtHeader(
  value: string | null | undefined,
): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function parseAuthNonceHeader(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const bytes = base64ToBytes(trimmed);
    if (bytes.length !== AUTH_NONCE_BYTES) {
      return null;
    }
  } catch {
    return null;
  }
  return trimmed;
}

/** Mint a one-time API auth nonce (12 random bytes, standard base64). */
export function generateAuthNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(AUTH_NONCE_BYTES));
  return bytesToBase64(bytes);
}

export async function signAuthProof(
  signingPrivateKey: CryptoKey,
  keyId: string,
  proof: AuthProofContext,
  request: AuthRequestDescriptor,
): Promise<string> {
  const signable = await buildAuthSignable(keyId, proof, request);
  return signCanonicalBody(signingPrivateKey, signable);
}

export async function verifyAuthProof(
  publicJwk: JsonWebKey,
  keyId: string,
  proof: AuthProofContext,
  signature: string,
  request: AuthRequestDescriptor,
): Promise<void> {
  const signable = await buildAuthSignable(keyId, proof, request);
  await verifyCanonicalSignature(
    publicJwk,
    signature,
    signable,
    'API authentication signature verification failed.',
  );
}

export type AuthRequestHeaders = {
  keyId: string;
  publicKey: AuthPublicKeyCoords;
  timeSlot: number;
  nonce: string;
  signature: string;
};

export function parseAuthTimeSlotHeader(
  value: string | undefined,
): number | null {
  if (value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

/** Build header map for feed API requests. */
export function authHeadersToRecord(
  headers: AuthRequestHeaders,
): Record<string, string> {
  return {
    [AUTH_HEADER_KEY_ID]: headers.keyId,
    [AUTH_HEADER_PUBLIC_KEY]: formatAuthPublicKeyWire(headers.publicKey),
    [AUTH_HEADER_TIME_SLOT]: String(headers.timeSlot),
    [AUTH_HEADER_NONCE]: headers.nonce,
    [AUTH_HEADER_SIGNATURE]: headers.signature,
  };
}

export { serializeForSigning };
