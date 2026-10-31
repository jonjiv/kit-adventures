import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths so the built folder works when hosted in any subfolder.
  base: './',
  server: { port: 5173 },
  // Three.js alone is about 500 kB, so the default warning would always fire.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
