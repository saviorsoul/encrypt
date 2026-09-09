import { describe, expect, it } from 'vitest';
import Koa from 'koa';
import { createHealthRouter } from '../routes/health.js';
import { requestApp } from './requestApp.js';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const app = new Koa();
    const router = createHealthRouter();
    app.use(router.routes()).use(router.allowedMethods());

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/health',
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
  });
});
