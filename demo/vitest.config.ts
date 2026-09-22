// The demo runs from this repository before node-test-kit is installed as a package.
import { defineConfig } from '../src/vitest/config.js';

export default defineConfig({
  test: {
    include: ['demo/**/*.test.ts']
  },
  application: {
    command: 'node --experimental-strip-types demo/dummy-api.ts',
    url: 'http://127.0.0.1:4000/health'
  }
});
