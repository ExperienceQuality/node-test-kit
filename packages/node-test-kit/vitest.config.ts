import { defineConfig } from './src/vitest/config.js';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts', 'test/integration/stub-lifecycle.test.ts']
  }
});
