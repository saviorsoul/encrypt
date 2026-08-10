import { registerPlugin } from '@capacitor/core';

export interface FeedLabExternalBrowserPlugin {
  getReferringBrowserPackage(): Promise<{ packageName: string | null }>;
  openInBrowser(options: {
    url: string;
    packageName?: string | null;
    background?: boolean;
  }): Promise<void>;
  returnToCaller(): Promise<void>;
}

export const FeedLabExternalBrowser =
  registerPlugin<FeedLabExternalBrowserPlugin>('FeedLabExternalBrowser');
