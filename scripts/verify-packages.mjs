import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = resolve(root, 'artifacts');
const packageNames = [
  '@xq/rest-client',
  '@xq/db',
  '@xq/stub',
  '@xq/core',
  '@xq/test'
];
const consumer = await mkdtemp(join(tmpdir(), 'xq-test-consumer-'));
const npmCache = resolve(consumer, '.npm-cache');

try {
  run('npm', ['run', 'build'], root);
  await rm(artifacts, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });

  for (const packageName of packageNames) {
    run('npm', ['pack', '--workspace', packageName, '--pack-destination', artifacts], root);
  }

  const archives = (await readdir(artifacts))
    .filter((name) => name.endsWith('.tgz'))
    .sort()
    .map((name) => resolve(artifacts, name));
  if (archives.length !== packageNames.length) {
    throw new Error(`expected ${packageNames.length} package archives, found ${archives.length}`);
  }

  await writeFile(join(consumer, 'package.json'), `${JSON.stringify({
    name: 'xq-test-package-smoke',
    version: '0.0.0',
    private: true,
    type: 'module'
  }, null, 2)}\n`);
  await writeFile(join(consumer, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: {
      target: 'ES2023',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      noEmit: true,
      types: ['node']
    },
    include: ['vitest.config.ts', 'test/**/*.ts']
  }, null, 2)}\n`);
  await mkdir(join(consumer, 'test'), { recursive: true });
  await writeFile(join(consumer, 'vitest.config.ts'), `import { defineConfig } from '@xq/test/vitest/config';

export default defineConfig({
  databases: { orders: { urlEnv: 'PACKAGE_SMOKE_DATABASE_URL', defaultSchema: 'sales' } },
  test: { include: ['test/**/*.test.ts'] }
});
`);
  await writeFile(join(consumer, 'test', 'package-imports.test.ts'), `import * as root from '@xq/test';
import type { Kysely } from '@xq/db';
import { expect, test } from '@xq/test/vitest';
import { defineConfig } from '@xq/test/vitest/config';

interface OrdersDatabase {
  orders: { id: number; status: string };
}

test('loads every public package entrypoint from packed archives', ({ kit }) => {
  expect(root.test).toBe(test);
  expect(root.expect).toBe(expect);
  expect(root.defineConfig).toBe(defineConfig);
  expect(kit.api).toBeDefined();
  const orders = kit.db.get<OrdersDatabase>('orders');
  expect(orders.selectFrom('orders').select('status').compile().sql)
    .toBe('select "status" from "sales"."orders"');
  expect(defineConfig()).toBeDefined();
});
`);
  await mkdir(join(consumer, 'features/steps'), { recursive: true });
  await writeFile(join(consumer, 'cucumber.mjs'), `import { defineCucumberConfig } from '@xq/test/cucumber/config';

export default defineCucumberConfig({ steps: 'features/steps/**/*.ts' });
`);
  await writeFile(join(consumer, 'features/order.feature'), `Feature: Packed Cucumber consumer

  @smoke
  Scenario: compose nested JSON
    Given a fresh company scenario context
    When I compose this body:
      | customer.id | items[0].sku |
      | "cust-123"  | "SKU-1"      |
    Then the body contains the nested customer
`);
  await writeFile(join(consumer, 'features/steps/order.steps.ts'), `import assert from 'node:assert/strict';
import { Given, Then, When, type DataTable } from '@cucumber/cucumber';
import { composeJsonTable, type XqWorld } from '@xq/test/cucumber';

type OrderWorld = XqWorld & { body?: unknown };

Given('a fresh company scenario context', function (this: XqWorld) {
  assert.ok(this.run.id);
  assert.ok(this.api);
});

When('I compose this body:', function (this: OrderWorld, table: DataTable) {
  this.body = composeJsonTable(table);
});

Then('the body contains the nested customer', function (this: OrderWorld) {
  assert.deepEqual(this.body, { customer: { id: 'cust-123' }, items: [{ sku: 'SKU-1' }] });
});
`);

  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...archives,
    '@cucumber/cucumber@^13.2.1',
    'vitest@^4.0.0',
    'typescript@^5.9.0',
    '@types/node@^24.0.0'
  ], consumer);
  run(resolve(consumer, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], consumer);
  run(resolve(consumer, 'node_modules/.bin/vitest'), ['run', '--config', 'vitest.config.ts'], consumer, {
    PACKAGE_SMOKE_DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test'
  });
  const cucumberEvents = join(consumer, 'cucumber-events.ndjson');
  run(resolve(consumer, 'node_modules/.bin/cucumber-js'), ['--tags', '@smoke'], consumer, {
    XQ_TEST_BASE_URL: 'http://127.0.0.1:4000',
    XQ_CUCUMBER_EVENTS_FILE: cucumberEvents
  });
  const events = (await readFile(cucumberEvents, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(events.map((event) => event.event), ['scenario.started', 'scenario.finished']);
  assert.equal(events[0].name, 'compose nested JSON');
  assert.equal(events[1].status, 'PASSED');

  console.log(`verified ${archives.length} archives in fresh NodeNext/Vitest and Cucumber consumers`);
} finally {
  await rm(consumer, { recursive: true, force: true });
}

function run(command, args, cwd, extraEnvironment = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnvironment, npm_config_cache: npmCache }
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  if (result.stdout.trim()) process.stdout.write(result.stdout);
  if (result.stderr.trim()) process.stderr.write(result.stderr);
}
