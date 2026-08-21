import type { Middleware } from 'koa';
import { API_PATH } from '@/config.js';
import { isPublicGetFriendInvitation } from '@/routes/friendInvitationRouteAccess.js';

const PUBLIC_API_ROUTES: Array<{ method: string; path: string }> = [
  { method: 'GET', path: `${API_PATH}/health` },
  { method: 'POST', path: `${API_PATH}/auth/challenge` },
];

function isPublicApiRoute(method: string, path: string): boolean {
  if (
    PUBLIC_API_ROUTES.some(
      (route) => route.method === method && route.path === path,
    )
  ) {
    return true;
  }

  return isPublicGetFriendInvitation(method, path);
}

/** Apply authentication to all /api routes except health. */
export function authenticateApiUnlessPublic(auth: Middleware): Middleware {
  return async (ctx, next) => {
    if (isPublicApiRoute(ctx.method, ctx.path)) {
      await next();
      return;
    }
    if (!ctx.path.startsWith(API_PATH)) {
      await next();
      return;
    }
    return auth(ctx, next);
  };
}
