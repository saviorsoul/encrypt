import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CapacitorConfig } from '@capacitor/cli';

function readEnvFileValue(envPath: string, key: string): string | undefined {
  try {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separator = trimmed.indexOf('=');
      if (separator === -1) {
        continue;
      }
      const envKey = trimmed.slice(0, separator).trim();
      if (envKey !== key) {
        continue;
      }
      return trimmed.slice(separator + 1).trim();
    }
  } catch {
    // optional env files
  }

  return undefined;
}

function readRootEnvValue(key: string): string | undefined {
  if (process.env[key]) {
    return process.env[key];
  }

  const repoRoot = resolve(__dirname, '../../..');
  return readEnvFileValue(resolve(repoRoot, '.env'), key);
}

function readBuiltApiUrl(): string | undefined {
  try {
    const raw = readFileSync(
      resolve(__dirname, '../dist/feednt-build-env.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw) as { apiUrl?: string };
    const apiUrl = parsed.apiUrl?.trim();
    return apiUrl || undefined;
  } catch {
    return undefined;
  }
}

const apiUrl = readBuiltApiUrl() ?? readRootEnvValue('VITE_API_URL')?.trim();
const forceHttpScheme =
  readRootEnvValue('FEEDNT_ANDROID_HTTP_SCHEME') === '1' ||
  readRootEnvValue('FEEDNT_ANDROID_HTTP_SCHEME') === 'true';
// Use http page origin when the API URL is plain HTTP (avoids mixed-content blocking).
const useHttpAndroidScheme =
  forceHttpScheme || !apiUrl || apiUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'com.feednt.app',
  appName: 'Feednt',
  webDir: '../dist',
  server: {
    // Capacitor defaults to https://localhost. That blocks http:// API calls
    // (mixed content). Use http scheme when the API URL is plain HTTP.
    androidScheme: useHttpAndroidScheme ? 'http' : 'https',
  },
  plugins: {
    // Route fetch/XHR through native HTTP so cross-origin API calls (e.g.
    // https://test.feednt.com) are not blocked by WebView CORS.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
