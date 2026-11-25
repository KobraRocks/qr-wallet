import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the app can be deployed at a domain root or any subpath.
  base: './',
  test: {
    // The only test seam is the injected Storage implementation; tests are pure
    // Node, with no DOM environment.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
