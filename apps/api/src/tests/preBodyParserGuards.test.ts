import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { MAX_BODY_BYTES } from '../constants.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { preBodyParserGuards } from '../middleware/preBodyParserGuards.js';
import { requestApp } from './requestApp.js';

function createGuardedApp(): Koa {
  const app = new Koa();
  app.use(errorHandler());
  app.use(preBodyParserGuards());
  app.use(bodyParser({ enableTypes: ['json'] }));
  app.use((ctx) => {
    ctx.status = 200;
    ctx.body = { ok: true };
  });
  return app;
}

async function requestWithDeclaredContentLength(
  app: Koa,
  contentLength: number,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app.callback());
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to bind test server.'));
        return;
      }

      const port = (address as AddressInfo).port;
      const request = http.request({
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/',
        headers: {
          'content-type': 'application/json',
          'content-length': String(contentLength),
        },
      });

      let responseBody = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          responseBody += chunk.toString();
        });
        response.on('end', () => {
          server.close();
          resolve({
            status: response.statusCode ?? 0,
            body: responseBody,
          });
        });
      });
      request.on('error', (error) => {
        server.close();
        reject(error);
      });

      request.end('{}');
    });
  });
}

describe('preBodyParserGuards', () => {
  it('rejects POST without application/json Content-Type', async () => {
    const response = await requestApp(createGuardedApp(), {
      method: 'POST',
      path: '/',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });

    expect(response.status).toBe(415);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Content-Type must be application/json.',
    });
  });

  it('rejects POST when Content-Length exceeds MAX_BODY_BYTES', async () => {
    const response = await requestWithDeclaredContentLength(
      createGuardedApp(),
      MAX_BODY_BYTES + 1,
    );

    expect(response.status).toBe(413);
    expect(JSON.parse(response.body)).toEqual({
      error: `Request body must not exceed ${MAX_BODY_BYTES} bytes.`,
    });
  });

  it('allows DELETE without a body', async () => {
    const response = await requestApp(createGuardedApp(), {
      method: 'DELETE',
      path: '/',
    });

    expect(response.status).toBe(200);
  });

  it('requires application/json for DELETE with a payload', async () => {
    const response = await requestApp(createGuardedApp(), {
      method: 'DELETE',
      path: '/',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });

    expect(response.status).toBe(415);
  });

  it('allows POST with application/json', async () => {
    const response = await requestApp(createGuardedApp(), {
      method: 'POST',
      path: '/',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    expect(response.status).toBe(200);
  });
});
