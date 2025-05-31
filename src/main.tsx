import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { TreeStoreProvider } from './store/TreeStore.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TreeStoreProvider>
      <App />
    </TreeStoreProvider>
  </StrictMode>
);