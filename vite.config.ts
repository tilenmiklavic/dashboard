import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist/web', emptyOutDir: true, target: 'es2022' },
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
