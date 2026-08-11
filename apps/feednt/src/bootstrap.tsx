import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import type { PlatformAdapter } from '@encrypt/platform';
import { PlatformProvider } from '@feednt/providers/PlatformProvider.tsx';
import { App } from '@feednt/App.tsx';

const useHashRouter =
  import.meta.env.VITE_FEEDNT_HASH_ROUTER === 'true' ||
  import.meta.env.VITE_FEEDNT_HASH_ROUTER === '1';

export function bootstrap(platform: PlatformAdapter): void {
  const Router = useHashRouter ? HashRouter : BrowserRouter;

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <PlatformProvider platform={platform}>
        <Router>
          <App />
        </Router>
      </PlatformProvider>
    </React.StrictMode>,
  );
}
