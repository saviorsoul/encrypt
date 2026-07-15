import type { Plugin } from 'vite';
import { getMetaContentSecurityPolicy } from '../csp.ts';

type ContentSecurityPolicyPluginOptions = {
  isDevServer: boolean;
  apiUrl?: string;
};

export function contentSecurityPolicyPlugin(
  options: ContentSecurityPolicyPluginOptions,
): Plugin {
  return {
    name: 'content-security-policy',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        const policy = getMetaContentSecurityPolicy(options);

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
