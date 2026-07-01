import Router from '@koa/router';
import type { RegisterUserRequest } from '../schemas/common.js';
import {
  parsePublicKey,
  validateKeyIdPublicKeyPairOrThrow,
} from '../schemas/parsePublicKey.js';
import { validateBody } from '../middleware/validateBody.js';
import { registerUser } from '../db/users.js';

export function createUsersRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.post('/users', validateBody('registerUserRequest'), async (ctx) => {
    const body = ctx.request.body as RegisterUserRequest;

    await validateKeyIdPublicKeyPairOrThrow(body.keyId, body.publicKey);
    const publicKey = parsePublicKey(body.publicKey);

    const user = await registerUser({
      keyId: body.keyId,
      publicKey,
    });

    ctx.status = 201;
    ctx.body = { keyId: user.keyId };
  });

  return router;
}
