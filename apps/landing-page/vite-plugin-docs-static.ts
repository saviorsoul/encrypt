import fs from 'node:fs';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite';

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
};

function resolveDocsFile(docsRoot: string, requestPath: string): string | null {
  let rel = requestPath.slice('/docs'.length) || '/';
  const isDirectoryPath = rel.endsWith('/');

  if (isDirectoryPath) {
    rel += 'index.html';
  } else if (!path.extname(rel)) {
    rel += '.html';
  }

  const candidates = [rel];
  if (isDirectoryPath || rel.endsWith('/index.html')) {
    candidates.push(rel.replace(/index\.html$/, 'README.html'));
  }

  for (const candidate of candidates) {
    const filePath = path.normalize(path.join(docsRoot, candidate));
    if (!filePath.startsWith(docsRoot)) {
      continue;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }

  return null;
}

function serveDocsRequest(
  docsRoot: string,
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) {
  const url = req.url?.split('?')[0] ?? '';
  if (!url.startsWith('/docs')) {
    next();
    return;
  }

  if (url === '/docs') {
    res.statusCode = 301;
    res.setHeader('Location', '/docs/');
    res.end();
    return;
  }

  const filePath = resolveDocsFile(docsRoot, url);
  if (filePath) {
    const ext = path.extname(filePath);
    res.setHeader(
      'Content-Type',
      MIME_TYPES[ext] ?? 'application/octet-stream',
    );
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const notFoundPath = path.join(docsRoot, '404.html');
  if (fs.existsSync(notFoundPath)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html');
    fs.createReadStream(notFoundPath).pipe(res);
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
}

function attachDocsMiddleware(
  docsRoot: string,
  server: Pick<ViteDevServer | PreviewServer, 'middlewares'>,
) {
  server.middlewares.use((req, res, next) =>
    serveDocsRequest(docsRoot, req, res, next),
  );
}

export function docsStaticPlugin(docsRoot: string): Plugin {
  return {
    name: 'feednt-docs-static',
    enforce: 'pre',
    configureServer(server) {
      attachDocsMiddleware(docsRoot, server);
    },
    configurePreviewServer(server) {
      attachDocsMiddleware(docsRoot, server);
    },
  };
}
