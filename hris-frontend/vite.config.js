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
  optimizeDeps: {
    // The kiosk's Face Liveness check is lazy-imported, so Vite would only
    // discover these on first visit to /kiosk and then 504 the in-flight
    // request while it re-optimizes. Pre-bundle them at startup instead.
    include: [
      'aws-amplify',
      '@aws-amplify/ui-react',
      '@aws-amplify/ui-react-liveness',
    ],
  },
});