import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The SDK is isolated in a lazy interaction chunk; the initial app remains small.
  build: { chunkSizeWarningLimit: 650 },
  test: { environment: 'jsdom' },
});
