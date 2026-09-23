# node-test-kit

Vitest-based foundation for backend functional and API E2E testing.

Use `defineConfig` from `node-test-kit/vitest/config`, and import the platform-owned `test` and `expect` from `node-test-kit/vitest`.

```ts
import { defineConfig } from 'node-test-kit/vitest/config';

export default defineConfig({
  application: { url: 'http://127.0.0.1:4000/health' }
});
```

```ts
import { expect, test } from 'node-test-kit/vitest';

test('uses the platform fixture', async ({ kit }) => {
  expect(kit.rest).toBeDefined();
});
```
