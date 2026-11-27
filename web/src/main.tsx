import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { flushQueue } from './api.ts';
import { initOfflineStore } from './offlineStore.ts';
import './styles.css';

// Load sets that were logged offline before the first render, so the workout screen
// shows them right away. initOfflineStore never rejects.
void initOfflineStore().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
  void flushQueue();
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* PWA install is optional */
    });
  });
}
