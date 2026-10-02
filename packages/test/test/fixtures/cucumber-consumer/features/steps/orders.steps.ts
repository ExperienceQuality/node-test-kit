import assert from 'node:assert/strict';
import { Before, Given, Then, When, type DataTable } from '@cucumber/cucumber';
import { composeJsonTable } from '@xq/test/cucumber/json';
import type { XqWorld } from '@xq/test/cucumber';

Before({ tags: '@before-failure' }, function () {
  throw new Error('intentional before hook failure');
});

Given('a scenario context exists', function (this: XqWorld & { marker?: string }) {
  assert.ok(this.run.id);
  assert.ok(this.api);
  this.marker = this.run.id;
});

When('I access the namespaced health endpoint', async function (this: XqWorld) {
  await this.api.get('/health').expectStatus(200).toss();
});

When('I compose an order JSON table', function (this: XqWorld & { order?: unknown }, table: DataTable) {
  this.order = composeJsonTable(table);
});

Then('the nested order is available', function (this: XqWorld & { order?: unknown }) {
  assert.deepEqual(this.order, {
    customer: { id: 'cust-123' },
    items: [{ sku: 'SKU-1', quantity: 2 }]
  });
});

Then('the scenario context remains local', function (this: XqWorld & { marker?: string }) {
  assert.equal(this.marker, this.run.id);
});
