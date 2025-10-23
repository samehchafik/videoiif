import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react({})],
  build: {
    outDir: 'demo-dist',      // <- dossier de sortie de la démo
    emptyOutDir: true,
    rollupOptions: { input: 'index.html' },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  server: {
    port: 3004,
  },
  optimizeDeps: {
    exclude: ['polygon-editor'],
  },
});
