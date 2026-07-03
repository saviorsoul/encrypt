/**
 * HTTP test helper for Koa integration tests.
 *
 * Spins up the given app on an ephemeral port, sends one request via fetch,
 * and returns status, body, and response headers (lowercased keys). Used by
 * auth challenge / nonce rotation tests that need a real HTTP round-trip
 * without a running server or external tools like supertest.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type Koa from 'koa';

export async function requestApp(
  app: Koa,
  init: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app.callback());
    server.listen(0, async () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to bind test server.'));
        return;
      }
      const port = (address as AddressInfo).port;
      try {
        const response = await fetch(`http://127.0.0.1:${port}${init.path}`, {
          method: init.method,
          headers: init.headers,
          body: init.body,
        });
        const body = await response.text();
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
        resolve({
          status: response.status,
          body,
          headers,
        });
      } catch (error) {
        reject(error);
      } finally {
        server.close();
      }
    });
  });
}
