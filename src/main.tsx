// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { TreeStoreProvider } from './store/TreeStore.tsx';
import { FilterProvider } from './store/FilterStore.tsx';
import 'maplibre-gl/dist/maplibre-gl.css';
// REMOVE THE FOLLOWING LINE:
// import 'maplibre-gl-draw/dist/maplibre-gl-draw.css'; 

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TreeStoreProvider>
      <FilterProvider>
        <App />
      </FilterProvider>
    </TreeStoreProvider>
  </StrictMode>
);