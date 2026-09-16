import { defineConfig } from 'node-test-kit/vitest/config';

export default defineConfig({
  test: {
    include: ['demo/**/*.test.js']
  },
  application: {
    command: 'node demo/dummy-api.js',
    url: 'http://127.0.0.1:4000/health'
  }
});
