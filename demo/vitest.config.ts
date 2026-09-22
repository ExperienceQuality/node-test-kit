import { defineConfig } from 'node-test-kit/vitest/config';

export default defineConfig({
  test: {
    include: ['demo/**/*.test.ts']
  },
  application: {
    command: 'node --experimental-strip-types demo/dummy-api.ts',
    url: 'http://127.0.0.1:4000/health'
  }
});
