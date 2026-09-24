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
import { expect, test } from 'node-test-kit/vitest';

interface PrimaryDatabase {
  users: { id: number; email: string };
}

declare module 'node-test-kit/vitest' {
  interface NodeTestKitDatabases {
    primary: PrimaryDatabase;
  }
}

test('uses the platform fixture', async ({ kit }) => {
  expect(kit.rest).toBeDefined();
  expect(kit.api).toBe(kit.rest);
  const users = await kit.db.primary.selectFrom('users').selectAll().execute();
});
```

One Kysely/`pg` client is created per configured database per Vitest worker and
closed during worker teardown. Consumers own migrations and test-data cleanup.
