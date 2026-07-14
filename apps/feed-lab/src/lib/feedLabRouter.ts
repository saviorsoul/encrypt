import { BrowserRouter, HashRouter } from 'react-router-dom';

/** GCS static URLs put the bucket in pathname; BrowserRouter never matches app routes there. */
export const FeedLabRouter = import.meta.env.PROD ? HashRouter : BrowserRouter;
