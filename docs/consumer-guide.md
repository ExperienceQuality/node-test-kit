# Node consumer guide

This guide is for an application repository that consumes the internal XQ test
platform. The application owns `.feature` files and business step definitions;
`@experiencequality/test` supplies the runtime, World, fixtures, and observability.

## Install the released kit

The packages are internal and are published to GitHub Packages. Configure a
read-only token in the consumer environment, not in source control:

```ini
# .npmrc (or the equivalent CI-generated user config)
@xq:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Install the facade and its compatible peer tools at exact versions:

```bash
npm install --save-dev @experiencequality/test@1.0.0 @cucumber/cucumber@13.2.1 vitest@4.1.11
```

Consumers normally import only `@experiencequality/test`. The `@experiencequality/core`, `@experiencequality/db`,
`@experiencequality/rest-client`, and `@experiencequality/stub` packages are internal implementation
dependencies resolved from the same private registry.

## Minimal Cucumber setup

Keep Cucumber as the runner. Create a small `cucumber.mjs` in the application:

```js
import { defineCucumberConfig } from '@experiencequality/test/cucumber/config';

export default defineCucumberConfig({
  steps: 'features/steps/**/*.ts'
});
```

Run standard Cucumber commands from the IDE, CI, or shell:

```bash
XQ_TEST_BASE_URL=http://127.0.0.1:8080 \
  npx cucumber-js features/orders.feature --tags '@smoke'
```

`cucumber-js` still owns discovery, filtering, parallelism, formatters, IDE
integration, and exit status. Each scenario receives a fresh `XqWorld` with
`api`/`rest`, `run`, and `config`.

## Compose request JSON from a table

Use field paths as column headers. JSON literals retain their types; bare text
is a string. A single data row creates an object, while multiple rows create an
array of objects.

```gherkin
When I submit an order:
  | customer.id | customer.name | items[0].sku | items[0].quantity |
  | "cust-123"  | Ada Lovelace  | "SKU-1"      | 2                 |
```

```ts
import { When, type DataTable } from '@cucumber/cucumber';
import { composeJsonTable, type XqWorld } from '@experiencequality/test/cucumber';

When('I submit an order:', async function (this: XqWorld, table: DataTable) {
  const body = composeJsonTable(table);
  await this.api.post('/orders').withJson(body).expectStatus(201).toss();
});
```

Duplicate/conflicting paths, blank cells, malformed paths, and sparse arrays
fail with row/column diagnostics. Use a doc string for arbitrary JSON keys or
documents that cannot be represented by a dotted/indexed header.

## Assert response JSON from tables

For a request-specific step, attach the expectation to the pending Pactum
request. Awaiting the spec executes it once:

```ts
import { Then } from '@cucumber/cucumber';
import { expectJsonTable } from '@experiencequality/test/cucumber';

Then('the order response matches:', async function (table) {
  await expectJsonTable(this.api.get('/orders/123'), table, {
    mode: 'exact'
  }).expectStatus(200);
});
```

For business steps that make several assertions, execute once and retain the
public response in the scenario World:

```ts
import { assertJsonTable } from '@experiencequality/test/cucumber';

When('I retrieve the order', async function () {
  this.orderResponse = await this.api.get('/orders/123').expectStatus(200);
});

Then('the customer contains:', async function (table) {
  await assertJsonTable(this.orderResponse, table, {
    mode: 'contains',
    path: '$.customer'
  });
});

Then('the first item contains:', async function (table) {
  await assertJsonTable(this.orderResponse, table, {
    mode: 'contains',
    path: '$.items[0]'
  });
});
```

`exact` requires matching object keys and array order/length. `contains`
recursively allows extra object fields and extra unordered array items while
requiring distinct matches. Multiple path assertions reuse the captured
response and do not send another request.

## Environment and diagnostics

Set `XQ_TEST_BASE_URL` per test process. Optional lifecycle metadata can be
written with `XQ_CUCUMBER_EVENTS_FILE`; event records omit request bodies,
step arguments, attachments, and secrets. Keep application secrets in CI
secret storage and never put tokens in `.npmrc` committed to the repository.
