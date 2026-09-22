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

The platform global setup starts one PactumJS mock server for the Vitest run
and provides serializable server metadata to isolated workers. The `kit`
fixture is created per test and removes only its owned interactions during
teardown.

## Kit fixture

Every test using `node-test-kit/vitest` receives one isolated `kit` fixture:

| Member | Purpose |
| --- | --- |
| `kit.api` | HTTP client for the application under test. Adds the test namespace header. |
| `kit.stub` | Runtime PactumJS interaction control. Owns interaction cleanup. |
| `kit.run` | Test ID, worker ID, backend URL, and mock metadata. |

The default mock server binds to loopback on an available port. Configure a
fixed port only when the test process owns that port:

```ts
export default defineConfig({
  mock: {
    host: '127.0.0.1',
    port: 9393
  },
  application: {
    command: 'node --experimental-strip-types demo/dummy-api.ts',
    url: 'http://127.0.0.1:4000/health'
  }
});
```

The demo adds a payment interaction at runtime, starts `demo/dummy-api.ts`,
and verifies the complete request chain:

```text
test -> dummy backend POST /orders
     -> platform stub POST /payments
     -> dummy backend returns paymentId
```

## Runtime mock fixture

`kit.stub` controls the shared PactumJS server from the test worker:

```js
const interaction = await kit.stub.add({
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

await kit.stub.verify(interaction.id, { exercised: true, callCount: 1 });
await kit.stub.remove(interaction.id);
```

Available operations: `add`, `get`, `verify`, `remove`, and `clear`.
Interactions use PactumJS request/response syntax. Fixture cleanup removes
only interactions created by that test. Do not call PactumJS global
`clearInteractions()` from consumer tests.

Use `verify` when a downstream call is part of the behavior contract:

```js
const payment = await kit.stub.add({
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

const response = await kit.api.post('/orders', {
  data: { productId: 'product-1' }
});

expect(response.status).toBe(201);
await kit.stub.verify(payment.id, { exercised: true, callCount: 1 });
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

Run it with:

```bash
npm run demo
```

## TypeScript development

The package source, tests, and demo are TypeScript. Type-check with `npm run
check`; build JavaScript and declaration files into `dist/` with `npm run
build`. Published consumers use the compiled package exports, while Vitest
resolves the TypeScript source directly during local development.
