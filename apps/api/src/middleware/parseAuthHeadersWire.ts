import {
  AUTH_HEADER_KEY_ID,
  AUTH_HEADER_NONCE,
  AUTH_HEADER_PUBLIC_KEY,
  AUTH_HEADER_SIGNATURE,
  AUTH_HEADER_TIME_SLOT,
  parseAuthTimeSlotHeader,
} from '@encrypt/core/crypto/authProof';
import type { AuthHeadersWire } from '../schemas/common.js';

function readHeader(
  ctx: { get: (name: string) => string | undefined },
  name: string,
): string {
  const value = ctx.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/** Build a fixed-key auth header object from the request (no dynamic header keys). */
export function parseAuthHeadersWire(ctx: {
  get: (name: string) => string | undefined;
}): AuthHeadersWire | null {
  const keyId = readHeader(ctx, AUTH_HEADER_KEY_ID);
  const publicKey = readHeader(ctx, AUTH_HEADER_PUBLIC_KEY);
  const signature = readHeader(ctx, AUTH_HEADER_SIGNATURE);
  const nonce = readHeader(ctx, AUTH_HEADER_NONCE);
  const timeSlot = parseAuthTimeSlotHeader(
    readHeader(ctx, AUTH_HEADER_TIME_SLOT),
  );

  if (!keyId || !publicKey || !signature || !nonce || timeSlot === null) {
    return null;
  }

  return { keyId, publicKey, timeSlot, nonce, signature };
}
