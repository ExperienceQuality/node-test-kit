# node-test-kit

Vitest-based foundation for backend functional and API E2E testing.

## Monorepo layout

- `packages/rest-client/` owns the backend HTTP client.
- `packages/db/` owns typed PostgreSQL clients built with Kysely and `pg`.
- `packages/stub/` owns the PactumJS server and runtime interaction client.
- `packages/core/` composes lifecycle, run-context, API, and stub behavior.
- `packages/node-test-kit/` owns the stable public package and Vitest adapter.
- `examples/backend-e2e/` exercises the packed consumer contract.

`packages/rest-client/` provides a small PactumJS-backed client. It creates a
native fluent `Spec`, injects the test namespace, and captures final request
and response data after `toss()` or implicit `await`. `kit.rest` uses this
client internally.

Every workspace keeps implementation in `src/` and tests in `test/`. The root
package is private and contains only npm-workspace orchestration.

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
  console.log(kit.rest, kit.stub, kit.run);
});
```

The platform global setup starts one PactumJS mock server for the Vitest run
and provides serializable server metadata to isolated workers. The `kit`
fixture is created per test and removes only its owned interactions during
teardown.

## Kit fixture

Every test using `node-test-kit/vitest` receives one isolated `kit` fixture:

| Member | Purpose |
| --- | --- |
| `kit.api` | Compatibility alias for `kit.rest`. |
| `kit.rest` | PactumJS fluent `Spec` client for the application under test. Captures requests and responses. |
| `kit.db.<name>` | Named, typed Kysely client configured for the current worker. |
| `kit.stub` | Runtime PactumJS interaction control. Owns interaction cleanup. |
| `kit.run` | Test ID, worker ID, backend URL, and mock metadata. |

## Typed PostgreSQL clients

The framework keeps ownership of the exported `test` function. Consumers register
their database types by augmenting `NodeTestKitDatabases`, then configure matching
runtime names with environment-backed descriptors:

```ts
// vitest.config.ts
import { defineConfig } from 'node-test-kit/vitest/config';

export default defineConfig({
  databases: {
    orders: { urlEnv: 'ORDERS_DATABASE_URL' },
    analytics: {
      urlEnv: 'ANALYTICS_DATABASE_URL',
      defaultSchema: 'reporting',
      pool: { max: 4 }
    }
  }
});
```

```ts
interface OrdersDatabase {
  orders: { id: number; status: string };
}

interface AnalyticsDatabase {
  daily_metrics: { day: string; order_count: number };
}

declare module 'node-test-kit/vitest' {
  interface NodeTestKitDatabases {
    orders: OrdersDatabase;
    analytics: AnalyticsDatabase;
  }
}
```

Tests continue to import the platform-owned fixture:

```ts
import { test } from 'node-test-kit/vitest';

test('checks an order and its reporting data', async ({ kit }) => {
  const order = await kit.db.orders
    .selectFrom('orders')
    .selectAll()
    .executeTakeFirstOrThrow();

  const metrics = await kit.db.analytics
    .selectFrom('daily_metrics')
    .selectAll()
    .execute();
});
```

The database package creates clients, while the Vitest adapter composes them into
the public fixture; `core` remains database agnostic. Each configured name creates
one `pg` pool and Kysely client per Vitest worker.
Worker teardown closes every client. `defaultSchema` applies a schema to all
unqualified queries; use Kysely's `withSchema()` when one database contains
multiple PostgreSQL schemas.

Configuration contains environment variable names, never connection strings.
The worker reads each URL from its environment. Missing variables fail with the
database name and variable name. Tests without `databases` keep `kit.db` as an
empty object and require no PostgreSQL configuration.

Consumers own migrations and schema type generation. They also own cleanup for
rows created by tests or the application under test. A transaction opened through
`kit.db` cannot roll back writes made through the application's separate pool.

The default mock server binds to loopback on an available port. Configure a
fixed port only when the test process owns that port:

```ts
export default defineConfig({
  mock: {
    host: '127.0.0.1',
    port: 9393
  },
  application: {
    command: 'node --experimental-strip-types src/dummy-api.ts',
    url: 'http://127.0.0.1:4000/health'
  }
});
```

The demo adds a payment interaction at runtime, starts
`examples/backend-e2e/src/dummy-api.ts`,
and verifies the complete request chain:

```text
test -> dummy backend POST /orders
     -> platform stub POST /payments
     -> dummy backend returns paymentId
```

## Runtime mock fixture

`kit.stub` exposes PactumJS mock operations through a per-test class:

```js
const interactionId = await kit.stub.addInteraction({
  request: {
    method: 'GET',
    path: '/inventory/{id}',
    pathParams: { id: 'item-1' }
  },
  response: {
    status: 200,
    body: { id: 'item-1', inStock: true }
  }
});

const interaction = await kit.stub.getInteraction(interactionId);
expect(interaction.exercised).toBe(true);
expect(interaction.callCount).toBe(1);
await kit.stub.removeInteraction(interactionId);
```

Available operations: `addInteraction`, `getInteraction`,
`removeInteraction`, and `clearInteractions`. Interactions use PactumJS
request/response syntax. Fixture cleanup removes only interactions created by
that test. Do not call PactumJS global state directly from consumer tests.

Use `verify` when a downstream call is part of the behavior contract:

```js
const payment = await kit.stub.addInteraction({
  request: {
    method: 'POST',
    path: '/payments',
    body: { productId: 'product-1' }
  },
  response: {
    status: 201,
    body: { paymentId: 'pay-123' }
  }
});

const response = await kit.rest
  .post('/orders')
  .withJson({ productId: 'product-1' })
  .expectStatus(201)
  .toss();

expect(response.statusCode).toBe(201);
const paymentInteraction = await kit.stub.getInteraction(payment);
expect(paymentInteraction.exercised).toBe(true);
expect(paymentInteraction.callCount).toBe(1);
```

`add` returns an interaction ID. `get` exposes PactumJS call metadata;
`verify` can assert `exercised` and exact `callCount`. `remove` deletes one
owned interaction. `clear` removes all interactions owned by the current
test. Fixture teardown calls `clear` automatically, including after a test
failure.

The fixture adds reserved header `x-node-test-kit-namespace` to every
interaction. The application under test must forward this header to mocked
downstream requests for parallel test isolation. Example application
forwarding:

```js
const namespace = request.headers['x-node-test-kit-namespace'] ?? '';
await fetch(`${process.env.NODE_TEST_KIT_STUB_URL}/payments`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-node-test-kit-namespace': namespace
  },
  body: JSON.stringify(input)
});
```

Global setup provides:

```js
{
  mock: {
    baseUrl,
    host,
    port,
    managementUrl,
    namespaceHeader
  },
  backendUrl
}
```

`NODE_TEST_KIT_STUB_URL` is passed to an application started by the kit.
PactumJS mock health endpoint is `${baseUrl}/api/pactum/health`.

Run framework E2E with:

```bash
npm run test:e2e
```

`npm run demo` remains a compatibility alias.

## TypeScript development

All package source, tests, and the E2E example are TypeScript. Install once from
the repository root, then use `npm run check`, `npm test`, `npm run test:e2e`,
and `npm run build`. Compiled package output is written to each package's `dist/`
directory; consumers continue to use only the `node-test-kit` export map.

`npm run verify:structure` enforces the flat workspace layout and dependency
boundaries. `npm run verify:packages` builds and packs all five library
workspaces, installs their archives together in a fresh temporary consumer,
type-checks that consumer with NodeNext resolution, and runs the legacy public
imports under Vitest. The packages remain private; the generated archives are
an integration artifact, not a publication action.
