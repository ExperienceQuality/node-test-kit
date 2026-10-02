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

## Cucumber

`@xq/test` also provides an optional Cucumber integration. Install a compatible
`@cucumber/cucumber` peer in the application, then keep the project's Cucumber
configuration small:

```js
// cucumber.mjs
import { defineCucumberConfig } from '@xq/test/cucumber/config';

export default defineCucumberConfig({
  steps: 'features/steps/**/*.ts'
});
```

Run it with the standard `cucumber-js` executable. Cucumber owns feature
discovery, scenario selection, tag/name filters, parallelism, IDE integration,
and exit status. The config defaults to `features/**/*.feature`; pass `paths`
when a project keeps features elsewhere. CLI options such as `--tags`, `--name`,
and `--parallel` remain Cucumber options.

Each scenario receives a fresh `XqWorld` with `api`/`rest`, `run`, and `config`.
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
import { composeJsonTable, type XqWorld } from '@xq/test/cucumber';

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

The company Cucumber plugin preserves Cucumber's native formatter output and,
when `XQ_CUCUMBER_EVENTS_FILE` is set, appends metadata-only scenario lifecycle
events as NDJSON. It omits step arguments, attachments, request data, and secrets.
