import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  //base: '/pune-tree-dashboard-sample/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: { // Add this build object
    outDir: 'docs' // Specify the output directory as 'docs'
  }
});