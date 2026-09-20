import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/index.css';
import App from '@/App.jsx';
import reportWebVitals from '@/reportWebVitals';
import { initSessionPrivateKeyStoragePreference } from '@/utils/sessionPrivateKeyPreference.ts';
import { initCapacitorBridge } from './platform/initCapacitorBridge.ts';

initCapacitorBridge();
initSessionPrivateKeyStoragePreference();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

reportWebVitals();
