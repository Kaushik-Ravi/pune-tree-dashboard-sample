// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // Import the path module

export default defineConfig({
  plugins: [react()],
  // This section is a best practice for resolving module paths
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // This is the CRITICAL fix for the development server
  server: {
    watch: {
      // Exclude the massive 'details' directory from the file watcher
      ignored: [
        '**/public/details/**',
      ],
    },
  },
  build: {
    outDir: 'docs'
  }
});