import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: {
    // Single self-contained bundle so static hosting works anywhere.
    target: 'es2020',
    cssCodeSplit: false,
  },
});
