import crypto from 'node:crypto';
import type { IndexHtmlTransformContext, Plugin } from 'vite';
import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup';

const SRI_ALGORITHM = 'sha384';

function hashContent(source: string | Uint8Array): string {
  const data =
    typeof source === 'string' ? Buffer.from(source) : Buffer.from(source);
  const digest = crypto.createHash(SRI_ALGORITHM).update(data).digest('base64');

  return `${SRI_ALGORITHM}-${digest}`;
}

function buildIntegrityMap(bundle: OutputBundle): Map<string, string> {
  const integrityByFile = new Map<string, string>();

  for (const [fileName, item] of Object.entries(bundle)) {
    if (item.type === 'chunk') {
      integrityByFile.set(fileName, hashContent((item as OutputChunk).code));
      continue;
    }

    if (item.type === 'asset') {
      const source = (item as OutputAsset).source;
      if (source !== undefined && source !== null) {
        integrityByFile.set(fileName, hashContent(source));
      }
    }
  }

  return integrityByFile;
}

function resolveBundleFileName(src: string): string | null {
  const normalized = src.replace(/^\.\//, '');
  const assetsIndex = normalized.lastIndexOf('assets/');

  if (assetsIndex >= 0) {
    return normalized.slice(assetsIndex);
  }

  return normalized.startsWith('assets/') ? normalized : null;
}

function injectIntegrityAttributes(
  attributes: string,
  src: string,
  integrityByFile: Map<string, string>,
): string {
  const fileName = resolveBundleFileName(src);
  if (!fileName) {
    return attributes;
  }

  const integrity = integrityByFile.get(fileName);
  if (!integrity) {
    return attributes;
  }

  const updated = attributes.replace(/\scrossorigin(?:="[^"]*")?/, '');

  if (/\sintegrity=/.test(updated)) {
    return updated.replace(/\sintegrity="[^"]*"/, ` integrity="${integrity}"`);
  }

  return `${updated} integrity="${integrity}"`;
}

function applySubresourceIntegrity(
  html: string,
  ctx: IndexHtmlTransformContext,
): string {
  if (!ctx.bundle) {
    return html;
  }

  const integrityByFile = buildIntegrityMap(ctx.bundle);

  html = html.replace(
    /<script\b([^>]*\ssrc="([^"]+)"[^>]*)>/g,
    (_match, attributes: string, src: string) =>
      `<script${injectIntegrityAttributes(attributes, src, integrityByFile)}>`,
  );

  html = html.replace(
    /<link\b([^>]*\shref="([^"]+)"[^>]*)>/g,
    (match, attributes: string, src: string) => {
      if (!/\srel="stylesheet"/.test(match)) {
        return match;
      }

      return `<link${injectIntegrityAttributes(attributes, src, integrityByFile)}>`;
    },
  );

  return html;
}

export function subresourceIntegrityPlugin(): Plugin {
  return {
    name: 'subresource-integrity',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        return applySubresourceIntegrity(html, ctx);
      },
    },
  };
}
