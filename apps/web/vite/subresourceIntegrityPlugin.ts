import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { OutputBundle } from 'rollup';

const SRI_ALGORITHM = 'sha384';

type SubresourceIntegrityPluginOptions = {
  enabled?: boolean;
};

function hashContent(source: string | Uint8Array): string {
  const data =
    typeof source === 'string' ? Buffer.from(source) : Buffer.from(source);
  const digest = crypto.createHash(SRI_ALGORITHM).update(data).digest('base64');

  return `${SRI_ALGORITHM}-${digest}`;
}

function buildIntegrityMapFromDisk(
  bundle: OutputBundle,
  outputDir: string,
): Map<string, string> {
  const integrityByFile = new Map<string, string>();

  for (const fileName of Object.keys(bundle)) {
    const filePath = path.join(outputDir, fileName);
    const content = fs.readFileSync(filePath);
    integrityByFile.set(fileName, hashContent(content));
  }

  return integrityByFile;
}

function resolveBundleFileName(src: string): string | null {
  const normalized = src.replace(/^\.\//, '').replace(/^\//, '');
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
  integrityByFile: Map<string, string>,
): string {
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

export function subresourceIntegrityPlugin(
  options: SubresourceIntegrityPluginOptions = {},
): Plugin {
  const enabled = options.enabled ?? true;

  return {
    name: 'subresource-integrity',
    apply: 'build',
    writeBundle(outputOptions, bundle) {
      if (!enabled) {
        return;
      }

      const outputDir = outputOptions.dir;
      if (!outputDir) {
        return;
      }

      const htmlPath = path.join(outputDir, 'index.html');
      if (!fs.existsSync(htmlPath)) {
        return;
      }

      const integrityByFile = buildIntegrityMapFromDisk(bundle, outputDir);
      const html = fs.readFileSync(htmlPath, 'utf8');
      const updatedHtml = applySubresourceIntegrity(html, integrityByFile);
      fs.writeFileSync(htmlPath, updatedHtml);
    },
  };
}
