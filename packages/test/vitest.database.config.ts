import { defineConfig } from './src/vitest/config.js';

export default defineConfig({
  databases: {
    primary: { urlEnv: 'NODE_TEST_KIT_DATABASE_URL' }
  },
  test: {
    include: ['test/integration/database-lifecycle.test.ts'],
    fileParallelism: false
  }
});
