import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:7878',
        changeOrigin: true,
      },
      '/live': {
        target: 'http://localhost:7878',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
