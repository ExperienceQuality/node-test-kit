# node-test-kit

Vitest-based foundation for backend functional and API E2E testing.

## POC layout

- `src/` contains the package implementation.
- `src/vitest/` contains the platform-owned Vitest adapter and config helper.
- `test/unit/` covers pure package behavior.
- `test/integration/` covers local process and HTTP boundaries.
- `test/e2e/` covers consumer-style backend workflows.
- `test/support/` contains deterministic test-only helpers.

The intended consumer setup is a small `vitest.config.ts` that imports
`defineConfig` from `node-test-kit/vitest/config`, while test files import the
platform-owned `test` and `expect` from `node-test-kit/vitest`.

## Current POC

```ts
// vitest.config.ts
import { defineConfig } from 'node-test-kit/vitest/config';

export default defineConfig({
  application: {
    url: 'http://127.0.0.1:4000/health'
  }
});
```

```ts
// orders.e2e.test.ts
import { test } from 'node-test-kit/vitest';

test('uses the platform-owned kit fixture', async ({ kit }) => {
  console.log(kit.api, kit.stub, kit.run);
});
```

The platform global setup starts one stub server for the Vitest run and
provides its URL to isolated workers. The `kit` fixture is created per test
and clears its stub namespace during teardown.

The demo adds a payment interaction at runtime, starts `demo/dummy-api.js`,
and verifies the complete request chain:

```text
test -> dummy backend POST /orders
     -> platform stub POST /payments
     -> dummy backend returns paymentId
```

Run it with:

```bash
npm run demo
```
