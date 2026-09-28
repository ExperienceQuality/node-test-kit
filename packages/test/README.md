# @xq/test

Vitest-based foundation for backend functional and API E2E testing.

Use `defineConfig` from `@xq/test/vitest/config`, and import the platform-owned `test` and `expect` from `@xq/test/vitest`.

```ts
import { defineConfig } from '@xq/test/vitest/config';

export default defineConfig({
  application: { url: 'http://127.0.0.1:4000/health' },
  databases: {
    primary: { urlEnv: 'TEST_DATABASE_URL' }
  }
});
```

```ts
import type { Kysely } from '@xq/db';
import { expect, test } from '@xq/test/vitest';

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
