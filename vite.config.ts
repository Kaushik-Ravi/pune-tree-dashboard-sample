// vite.config.ts (Corrected for Netlify)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // base: '/pune-tree-dashboard-sample/', // <-- DELETE THIS LINE
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'docs'
  }
});