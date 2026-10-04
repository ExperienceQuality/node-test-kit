# @experiencequality/test

`@experiencequality/test/vitest` owns the public `test` and `expect` functions. The
fixture gives each test an isolated REST client, database lookup, stub
interaction client, and run metadata.

## Fixture

| Member | Purpose |
| --- | --- |
| `kit.api` | Compatibility alias for `kit.rest`. |
| `kit.rest` | PactumJS fluent `Spec` client for the application under test. |
| `kit.db.get<Database>(name)` | Looks up a named, typed Kysely client for the current worker. |
| `kit.stub` | Runtime PactumJS interaction control with owned cleanup. |
| `kit.run` | Test ID, worker ID, backend URL, and mock metadata. |

## Database configuration

Configuration stores environment variable names, not connection strings:

```ts
import { defineConfig } from '@experiencequality/test/vitest/config';

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

Consumers own migrations, schema types, and cleanup for application-created
rows. Each configured database creates one pool per Vitest worker; teardown
closes every client. Missing variables fail with the database and variable
name.

## Runtime mock fixture

`kit.stub` owns interactions created by the current test:

```ts
const payment = await kit.stub.addInteraction({
  request: { method: 'POST', path: '/payments', body: { productId: 'p-123' } },
  response: { status: 201, body: { paymentId: 'pay-123' } }
});

const response = await kit.rest
  .post('/orders')
  .withJson({ productId: 'p-123' })
  .expectStatus(201)
  .toss();

expect(response.statusCode).toBe(201);
const interaction = await kit.stub.getInteraction(payment);
expect(interaction.exercised).toBe(true);
```

Available operations are `addInteraction`, `getInteraction`,
`removeInteraction`, and `clearInteractions`. Cleanup runs after the test,
including after failures. The application must forward the reserved
`x-node-test-kit-namespace` header to downstream mock requests for parallel
test isolation.
