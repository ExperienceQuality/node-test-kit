# node-test-kit

Vitest-based foundation for backend functional and API E2E testing.

Use `defineConfig` from `node-test-kit/vitest/config`, and import the platform-owned `test` and `expect` from `node-test-kit/vitest`.

```ts
import { defineConfig } from 'node-test-kit/vitest/config';

export default defineConfig({
  application: { url: 'http://127.0.0.1:4000/health' },
  databases: {
    primary: { urlEnv: 'TEST_DATABASE_URL' }
  }
});
```

```ts
import type { Kysely } from '@xq/node-test-kit-db';
import { expect, test } from 'node-test-kit/vitest';

interface PrimaryDatabase {
  users: { id: number; email: string };
}

test('uses the platform fixture', async ({ kit }) => {
  expect(kit.rest).toBeDefined();
  expect(kit.api).toBe(kit.rest);
  const database = kit.db.get<PrimaryDatabase>('primary');
  const users = await database.selectFrom('users').selectAll().execute();
});
```

One Kysely/`pg` client is created per configured database per Vitest worker and
closed during worker teardown. Consumers own migrations and test-data cleanup.
