import type { Plugin } from 'vite';
import { DEVELOPMENT_META_CSP, PRODUCTION_META_CSP } from '../electron/csp.js';

export function contentSecurityPolicyPlugin(isDevServer: boolean): Plugin {
  return {
    name: 'content-security-policy',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        const policy = isDevServer ? DEVELOPMENT_META_CSP : PRODUCTION_META_CSP;

        return [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: policy,
            },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}
