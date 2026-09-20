import { BrowserRouter, HashRouter } from 'react-router-dom';

function shouldUseBrowserRouter(): boolean {
  if (!import.meta.env.PROD) {
    return true;
  }

  const flag = import.meta.env.VITE_BROWSER_ROUTER;
  return flag === 'true' || flag === '1';
}

/** HashRouter is only for legacy GCS bucket URLs without a load balancer. */
export const FeedLabRouter = shouldUseBrowserRouter()
  ? BrowserRouter
  : HashRouter;
