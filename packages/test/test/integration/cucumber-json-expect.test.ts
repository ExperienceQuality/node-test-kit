import type { DataTable } from '@cucumber/cucumber';
import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRestClient } from '@experiencequality/rest-client';
import { assertJsonTable, expectJsonTable, registerJsonTableExpectation, type JsonTableResponse } from '../../src/cucumber/json-expect.js';

let baseUrl: string;

describe('Cucumber JSON table response expectations', () => {
  let closeServer: () => Promise<void>;

  beforeAll(async () => {
    registerJsonTableExpectation();
    const server = createServer((request, response) => {
      if (request.url === '/text') {
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('private response value');
        return;
      }
      response.writeHead(200, { 'content-type': request.url === '/problem' ? 'Application/Problem+Json; Charset=UTF-8' : 'application/json' });
      if (request.url === '/null') response.end('null');
      else if (request.url === '/one-array') response.end('[{"id":1}]');
      else if (request.url === '/overlap') response.end('[{"id":1,"name":"Ada"},{"id":1,"name":"other"}]');
      else if (request.url === '/array') response.end('[{"id":2,"name":"other"},{"id":1,"name":"Ada"},{"id":1,"name":"other"}]');
      else response.end('{"id":1,"customer":{"id":"cust-1","name":"Ada","private":"secret-value"}}');
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('JSON expectation test server did not bind');
    baseUrl = `http://127.0.0.1:${address.port}`;
    closeServer = () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  afterAll(async () => closeServer());

  it('attaches the shared Pactum expectation to a pending request', async () => {
    const spec = client().get('/data');
    await expectJsonTable(spec, table([['id', 'customer.id', 'customer.name', 'customer.private'], ['1', '"cust-1"', 'Ada', '"secret-value"']])).expectStatus(200);
  });

  it('accepts structured JSON media types with case-insensitive type and charset parameters', async () => {
    const response = await client().get('/problem').toss();
    await assertJsonTable(response, table([['id'], ['1']]), { mode: 'contains' });
  });

  it('asserts multiple path-scoped tables against the same executed spec', async () => {
    const spec = client().get('/data').expectStatus(200);
    const response = await spec;
    await assertJsonTable(response, table([['id', 'name', 'private'], ['"cust-1"', 'Ada', '"secret-value"']]), { path: '$.customer' });
    await assertJsonTable(response, table([['name'], ['Ada']]), { mode: 'contains', path: 'customer' });
  });

  it('uses unordered distinct-item contains semantics for arrays, including overlapping candidates', async () => {
    const spec = client().get('/array').expectStatus(200);
    const response = await spec.toss();
    await assertJsonTable(response, table([['id'], ['1'], ['2']]), { mode: 'contains' });
    const overlapExpected = [{ id: 1 }, { id: 1, name: 'Ada' }];
    // Register the same handler contract with objects of differing specificity to exercise rematching.
    const directSpec = client().get('/overlap').expectStatus(200);
    await directSpec.expect('xq-json-table', { expected: overlapExpected, mode: 'contains' }).toss();

    const duplicateSpec = client().get('/one-array').expectStatus(200);
    await expect(duplicateSpec.inspect(false).expect('xq-json-table', {
      expected: [{ id: 1 }, { id: 1 }], mode: 'contains'
    }).toss()).rejects.toThrow(/JSON contains assertion failed/);
  });

  it('handles JSON null, reports missing/non-JSON paths, and redacts response values', async () => {
    const nullSpec = client().get('/null');
    const nullResponse = await nullSpec.expect('xq-json-table', { expected: null, mode: 'exact' }).toss();
    expect(nullResponse.statusCode).toBe(200);

    const missingPathSpec = client().get('/data');
    const missingPathResponse = await missingPathSpec.toss();
    await expect(assertJsonTable(missingPathResponse, table([['id'], ['1']]), { path: 'missing' }))
      .rejects.toThrow('response JSON path "missing" was not found');

    const nonJsonSpec = client().get('/text');
    const nonJsonResponse = await nonJsonSpec.toss();
    await expect(assertJsonTable(nonJsonResponse, table([['id'], ['1']])))
      .rejects.toThrow('response is not valid JSON');

    await expect(assertJsonTable(undefined as unknown as JsonTableResponse, table([['id'], ['1']])))
      .rejects.toThrow('cannot assert JSON table without an executed response');

    const mismatchSpec = client().get('/data');
    const mismatchResponse = await mismatchSpec.toss();
    let failure: unknown;
    try {
      await assertJsonTable(mismatchResponse, table([['value'], ['"wrong-secret"']]), { path: 'customer.private' });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain('secret-value');
    expect((failure as Error).message).not.toContain('wrong-secret');
    expect((failure as Error).message).toContain('string');
  });
});

function client() {
  return createRestClient({ baseUrl, namespaceHeader: 'x-test-namespace', namespace: 'json-expect-test' });
}

function table(rows: string[][]): DataTable {
  return { raw: () => rows } as unknown as DataTable;
}
