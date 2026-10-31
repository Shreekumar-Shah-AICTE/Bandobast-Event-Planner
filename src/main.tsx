import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { chooseStorage } from './state/browserStorage.js';
import { todayIso } from './today.js';
import { App } from './ui/App.js';
import './styles.css';

const root = document.getElementById('root');
if (root !== null) {
  const { storage, persistent } = chooseStorage(() => window.localStorage);
  createRoot(root).render(
    <StrictMode>
      <App storage={storage} persistent={persistent} today={todayIso()} />
    </StrictMode>,
  );
}
