# @experiencequality/test

Vitest-based foundation for backend functional and API E2E testing.

Use `defineConfig` from `@experiencequality/test/vitest/config`, and import the platform-owned `test` and `expect` from `@experiencequality/test/vitest`.

```ts
import { defineConfig } from '@experiencequality/test/vitest/config';

export default defineConfig({
  application: { url: 'http://127.0.0.1:4000/health' },
  databases: {
    primary: { urlEnv: 'TEST_DATABASE_URL' }
  }
});
```

```ts
import type { Kysely } from '@experiencequality/db';
import { expect, test } from '@experiencequality/test/vitest';

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

## Cucumber

`@experiencequality/test` also provides an optional Cucumber integration. Install a compatible
`@cucumber/cucumber` peer in the application, then keep the project's Cucumber
configuration small:

```js
// cucumber.mjs
import { defineCucumberConfig } from '@experiencequality/test/cucumber/config';

export default defineCucumberConfig({
  steps: 'features/steps/**/*.ts'
});
```

Run it with the standard `cucumber-js` executable. Cucumber owns feature
discovery, scenario selection, tag/name filters, parallelism, IDE integration,
and exit status. The config defaults to `features/**/*.feature`; pass `paths`
when a project keeps features elsewhere. CLI options such as `--tags`, `--name`,
and `--parallel` remain Cucumber options.

Each scenario receives a fresh `XqWorld` with `api`/`rest`, namespaced `stub`,
`run`, and `config`. The kit starts one local Pactum server before the run,
sets `XQ_TEST_STUB_URL`, and clears only the current scenario's interactions
after each scenario. Use `XQ_TEST_STUB_URL` to point at an externally managed
server, or set `XQ_TEST_STUB_ENABLED=false` to disable automatic startup.
An explicitly stub-using step can call `await this.requireStub()` when startup
is disabled. `XQ_TEST_STUB_PORT` optionally selects a fixed local port.

```ts
When('I stub the payment lookup', async function (this: XqWorld) {
  const stub = await this.requireStub();
  await stub.addInteraction({
    request: { method: 'GET', path: '/payments/pay-1' },
    response: { status: 200, body: { status: 'paid' } }
  });
});
```

The API client sends `x-xq-test-namespace`; the stub client injects the
reserved `x-node-test-kit-namespace`. The application remains responsible for
forwarding the incoming namespace to downstream calls.

Set `XQ_TEST_BASE_URL` before running scenarios; missing or invalid URLs fail in
the company `Before` hook. TypeScript steps are registered through the framework's
`tsx` integration.

Use dotted and indexed header names to compose nested JSON. Valid JSON cells are
parsed as JSON; bare text that is not JSON becomes a string. Blank cells fail:

```gherkin
When I submit this order:
  | customer.id | customer.name | items[0].sku | items[0].quantity |
  | "cust-123"  | Ada Lovelace  | "SKU-1"      | 2                 |
```

```ts
import { When, type DataTable } from '@cucumber/cucumber';
import { composeJsonTable, type XqWorld } from '@experiencequality/test/cucumber';

When('I submit this order:', async function (this: XqWorld, table: DataTable) {
  const body = composeJsonTable(table);
  await this.api.post('/orders').withJson(body).toss();
});
```

One data row returns an object; multiple data rows return an array of objects.
The composer rejects duplicate/conflicting headers, malformed paths, blank
cells, and sparse arrays with header-column or row/column diagnostics. For
unusual object keys or arbitrary JSON documents, use Cucumber's native
DataTable/docstring APIs.

Response tables use the same composer contract through Pactum. The company
bootstrap registers the idempotent `xq-json-table` expectation handler.
Builder-style assertions attach to a pending request and execute with it:

```ts
const request = expectJsonTable(this.api.get('/orders/123'), table, { mode: 'exact' });
await request.expectStatus(200); // awaiting the Pactum spec executes toss()
```

For business-language steps that separate request execution from assertions,
retain the public response returned by awaiting the Pactum spec in the scenario
World. `assertJsonTable` accepts that captured response; repeated calls never
send another request:

```ts
this.orderResponse = await this.orderSpec;
await assertJsonTable(this.orderResponse, customerTable, { mode: 'exact', path: '$.customer' });
await assertJsonTable(this.orderResponse, itemTable, { mode: 'contains', path: '$.items[0]' });
```

`exact` compares object keys and array items/length exactly. `contains`
recursively ignores extra object properties. Arrays follow Pactum `jsonLike`
semantics: expected items match distinct actual items, order is ignored, and
extra actual items are allowed. Redacted failures identify the mode, path, and
value types without echoing JSON values. Missing paths, non-JSON responses, and
assertions before `toss()` produce explicit errors.

The company Cucumber plugin preserves Cucumber's native formatter output and,
when `XQ_CUCUMBER_EVENTS_FILE` is set, appends metadata-only scenario lifecycle
events as NDJSON. It omits step arguments, attachments, request data, and secrets.
