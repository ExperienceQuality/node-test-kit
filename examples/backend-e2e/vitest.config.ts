import { fileURLToPath } from 'node:url';
import { defineConfig } from 'node-test-kit/vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
  application: {
    command: 'node --experimental-strip-types src/dummy-api.ts',
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    url: 'http://127.0.0.1:4000/health'
  }
});
