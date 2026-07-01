import Router from '@koa/router';
import type { RegisterUserRequest } from '../schemas/common.js';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import { parseWirePublicKey } from '../schemas/parsePublicKey.js';
import { validateBody } from '../middleware/validateBody.js';
import { listUsers, registerUser } from '../db/users.js';

export function createUsersRouter(): Router {
  const router = new Router({ prefix: '/api' });

  router.get('/users', async (ctx) => {
    const users = await listUsers();
    ctx.body = users;
  });

  router.post('/users', validateBody('registerUserRequest'), async (ctx) => {
    const body = ctx.request.body as RegisterUserRequest;

    const publicKey = parseWirePublicKey(body.publicKey);
    const keyId = await ecPublicJwkThumbprintSha256(
      slimEcPublicJwk(publicKey as JsonWebKey),
    );

    const user = await registerUser({
      keyId,
      publicKey,
    });

    ctx.status = 201;
    ctx.body = { keyId: user.keyId };
  });

  return router;
}
