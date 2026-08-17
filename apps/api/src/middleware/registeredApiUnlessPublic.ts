import type { Middleware } from 'koa';
import { API_PATH } from '@/config.js';
import {
  isAuthOnlyPostFriendInvitationAccept,
  isPublicGetFriendInvitation,
} from '@/routes/friendInvitationRouteAccess.js';

const PUBLIC_API_ROUTES: Array<{ method: string; path: string }> = [
  { method: 'GET', path: '/health' },
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

/** Apply registered-user check to protected /api routes (after authenticate). */
export function registeredApiUnlessPublic(
  requireRegistered: Middleware,
): Middleware {
  return async (ctx, next) => {
    if (isPublicApiRoute(ctx.method, ctx.path)) {
      await next();
      return;
    }
    if (!ctx.path.startsWith(API_PATH)) {
      await next();
      return;
    }
    if (isAuthOnlyPostFriendInvitationAccept(ctx.method, ctx.path)) {
      await next();
      return;
    }
    return requireRegistered(ctx, next);
  };
}
