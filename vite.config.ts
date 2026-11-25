import { defineConfig } from 'vitest/config';
import { serviceWorkerPlugin } from './build/service-worker.ts';

export default defineConfig({
  // Relative base so the app can be deployed at a domain root or any subpath.
  base: './',
  plugins: [
    // Injects the hashed asset list and a content-derived build hash into the
    // hand-written service worker; a missing placeholder fails the build.
    serviceWorkerPlugin(),
  ],
  test: {
    // The only test seam is the injected Storage implementation; tests are pure
    // Node, with no DOM environment.
    environment: 'node',
    include: ['src/**/*.test.ts', 'build/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
