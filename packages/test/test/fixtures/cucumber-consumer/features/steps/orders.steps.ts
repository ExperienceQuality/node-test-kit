import assert from 'node:assert/strict';
import { Before, Given, Then, When, type DataTable } from '@cucumber/cucumber';
import { assertJsonTable, composeJsonTable, expectJsonTable, type JsonTableResponse } from '@experiencequality/test/cucumber';
import type { XqWorld } from '@experiencequality/test/cucumber';

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

When('I retrieve the order expecting this exact JSON:', async function (this: XqWorld, table: DataTable) {
  await expectJsonTable(this.api.get('/orders/123'), table, { mode: 'exact' }).expectStatus(200);
});

When('I assert a secret response value without printing it', async function (this: XqWorld) {
  const expectedSecret = process.env.XQ_EXPECTED_SECRET ?? 'expected-secret-sentinel';
  const table = { raw: () => [['customer.private'], [JSON.stringify(expectedSecret)]] } as unknown as DataTable;
  await expectJsonTable(this.api.get('/orders/123'), table, { mode: 'exact' }).expectStatus(200);
});

When('I retrieve the order', async function (this: XqWorld & { orderResponse?: JsonTableResponse }) {
  const orderSpec = this.api.get('/orders/123').expectStatus(200);
  this.orderResponse = await orderSpec;
});

Then('the response JSON at {string} exactly matches:', async function (
  this: XqWorld & { orderResponse?: JsonTableResponse },
  path: string,
  table: DataTable
) {
  if (!this.orderResponse) throw new Error('order request has not been executed');
  await assertJsonTable(this.orderResponse, table, { mode: 'exact', path });
});

Then('the response JSON at {string} contains:', async function (
  this: XqWorld & { orderResponse?: JsonTableResponse },
  path: string,
  table: DataTable
) {
  if (!this.orderResponse) throw new Error('order request has not been executed');
  await assertJsonTable(this.orderResponse, table, { mode: 'contains', path });
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
