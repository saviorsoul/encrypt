import type { AuthRequestDescriptor } from '@encrypt/core/api/feedApiAuth';

export type SignRequestPreview = {
  method: string;
  url: string;
  query: Record<string, string> | null;
  payload: unknown | null;
};

export function formatSignRequestPreview(
  descriptor: AuthRequestDescriptor,
  baseUrl: string,
): SignRequestPreview {
  const origin = baseUrl.replace(/\/$/, '');
  const url = new URL(
    descriptor.path.startsWith('/') ? descriptor.path : `/${descriptor.path}`,
    `${origin}/`,
  );
  if (descriptor.query) {
    for (const [key, value] of Object.entries(descriptor.query)) {
      url.searchParams.set(key, value);
    }
  }
  return {
    method: descriptor.method,
    url: url.toString(),
    query: descriptor.query ?? null,
    payload:
      descriptor.body === undefined ? null : (descriptor.body as unknown),
  };
}

export function formatSignRequestPayload(payload: unknown | null): string {
  if (payload === null || payload === undefined) {
    return '(empty)';
  }
  return JSON.stringify(payload, null, 2);
}

export type SignRequestMethodPaletteColor =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'info'
  | 'warning'
  | 'error';

const METHOD_PALETTE_COLORS: Record<string, SignRequestMethodPaletteColor> = {
  GET: 'info',
  POST: 'success',
  PUT: 'warning',
  PATCH: 'secondary',
  DELETE: 'error',
  HEAD: 'secondary',
  OPTIONS: 'primary',
};

export function signRequestMethodPalette(
  method: string,
): SignRequestMethodPaletteColor | null {
  return METHOD_PALETTE_COLORS[method.toUpperCase()] ?? null;
}
