import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 💡 Safely maps '@' directly to your absolute src directory path
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});