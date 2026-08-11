import type { Plugin } from 'vite';
import {
  buildNetworkAppMetaCsp,
  type NetworkAppCspOptions,
} from './networkAppCsp.ts';

export function contentSecurityPolicyPlugin(
  options: NetworkAppCspOptions,
): Plugin {
  return {
    name: 'content-security-policy',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        const policy = buildNetworkAppMetaCsp(options);

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
