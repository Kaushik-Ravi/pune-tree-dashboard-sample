import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'docs'
  },
  server: {
    // Enable headers for COG range requests
    headers: {
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    }
  }
});