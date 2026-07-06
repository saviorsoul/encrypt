import type { Middleware } from 'koa';

const PUBLIC_API_ROUTES: Array<{ method: string; path: string }> = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/api/auth/challenge' },
];

function isPublicApiRoute(method: string, path: string): boolean {
  if (
    PUBLIC_API_ROUTES.some(
      (route) => route.method === method && route.path === path,
    )
  ) {
    return true;
  }

  return method === 'GET' && /^\/api\/friend-invitations\/[^/]+$/.test(path);
}

/** Apply authentication to all /api routes except health. */
export function authenticateApiUnlessPublic(auth: Middleware): Middleware {
  return async (ctx, next) => {
    if (isPublicApiRoute(ctx.method, ctx.path)) {
      await next();
      return;
    }
    if (!ctx.path.startsWith('/api')) {
      await next();
      return;
    }
    return auth(ctx, next);
  };
}
