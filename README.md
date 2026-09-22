# node-test-kit

Vitest-based foundation for backend functional and API E2E testing.

## Monorepo layout

- `packages/api-client/` owns the backend HTTP client.
- `packages/stub/` owns the PactumJS server and runtime interaction client.
- `packages/core/` composes lifecycle, run-context, API, and stub behavior.
- `packages/node-test-kit/` owns the stable public package and Vitest adapter.
- `examples/backend-e2e/` exercises the packed consumer contract.

`packages/api-client/` exposes `OpenApiClient`, `ApiRequest`, and `ApiResponse`.
Consumers depend on these contracts only; PactumJS is private to the package and
backs `createOpenApiClient`. OpenAPI-style paths support `pathParams`, query
parameters, headers, and request bodies. `kit.api` uses this client internally.

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

All package source, tests, and the demo are TypeScript. Install once from the
repository root, then use `npm run check`, `npm test`, `npm run demo`, and
`npm run build`. Compiled package output is written to each package's `dist/`
directory; consumers continue to use only the `node-test-kit` export map.

`npm run verify:structure` enforces the flat workspace layout and dependency
boundaries. `npm run verify:packages` builds and packs all four library
workspaces, installs their archives together in a fresh temporary consumer,
type-checks that consumer with NodeNext resolution, and runs the legacy public
imports under Vitest. The packages remain private; the generated archives are
an integration artifact, not a publication action.
