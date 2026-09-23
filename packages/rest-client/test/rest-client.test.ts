import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createRestClient } from '../src/index.js';

let server: Server | undefined;

afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

describe('createRestClient', () => {
  it('preserves Pactum fluent chaining, injects namespace, and captures response', async () => {
    let requestHeaders: Record<string, string | string[] | undefined> = {};
    server = createServer((request, response) => {
      requestHeaders = request.headers;
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ created: true }));
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server did not start');

    const rest = createRestClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      namespaceHeader: 'x-node-test-kit-namespace',
      namespace: 'run-1'
    });

    const response = await rest
      .post('/users')
      .withJson({ name: 'Ada' })
      .expectStatus(201)
      .toss();

    expect(response.statusCode).toBe(201);
    expect(requestHeaders['x-node-test-kit-namespace']).toBe('run-1');
    expect(rest.captures).toHaveLength(1);
    expect(rest.captures[0]?.request).toMatchObject({
      method: 'POST',
      url: `http://127.0.0.1:${address.port}/users`,
      data: { name: 'Ada' },
      headers: { 'x-node-test-kit-namespace': 'run-1' }
    });
    expect((rest.captures[0]?.response as { statusCode?: number }).statusCode).toBe(201);
  });

  it('captures response through implicit await and reapplies reserved header', async () => {
    let namespace = '';
    server = createServer((request, response) => {
      namespace = String(request.headers['x-node-test-kit-namespace']);
      response.writeHead(204);
      response.end();
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server did not start');

    const rest = createRestClient({ baseUrl: `http://127.0.0.1:${address.port}`, namespaceHeader: 'x-node-test-kit-namespace', namespace: 'run-2' });
    const response = await rest.get('/health').withHeaders({ 'x-node-test-kit-namespace': 'wrong' });

    expect(response.statusCode).toBe(204);
    expect(namespace).toBe('run-2');
    expect(rest.captures[0]?.request).toMatchObject({
      method: 'GET',
      url: `http://127.0.0.1:${address.port}/health`,
      headers: { 'x-node-test-kit-namespace': 'run-2' }
    });
    expect(rest.captures[0]?.response).toBeDefined();
  });
});
