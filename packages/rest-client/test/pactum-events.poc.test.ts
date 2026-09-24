import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import pactum from 'pactum';

const { events, spec } = pactum;

describe('Pactum events POC', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
    server = undefined;
  });

  it('captures final request and response without patching Spec', async () => {
    const seen: Array<{ request: unknown; response: unknown }> = [];
    const receivedHeaders: Record<string, string | string[] | undefined>[] = [];
    const onBeforeRequest = ({ request }: { request: { headers?: Record<string, string> } }) => {
      request.headers ??= {};
      request.headers['x-node-test-kit-namespace'] = 'run-1';
    };
    const onResponse = ({ request, response }: { request: unknown; response: unknown }) => {
      seen.push({ request, response });
    };
    events.pactumEvents.on(events.EVENT_TYPES.BEFORE_REQUEST, onBeforeRequest);
    events.pactumEvents.on(events.EVENT_TYPES.AFTER_RESPONSE, onResponse);

    server = createServer((request, response) => {
      receivedHeaders.push(request.headers);
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ created: true }));
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server did not bind');

    const nativeSpec = spec()
      .post(`http://127.0.0.1:${address.port}/users`)
      .withHeaders('x-node-test-kit-namespace', 'wrong')
      .withJson({ name: 'Ada' })
      .expectStatus(201);

    const response = await nativeSpec;

    events.pactumEvents.off(events.EVENT_TYPES.BEFORE_REQUEST, onBeforeRequest);
    events.pactumEvents.off(events.EVENT_TYPES.AFTER_RESPONSE, onResponse);

    expect(response.statusCode).toBe(201);
    expect(receivedHeaders[0]?.['x-node-test-kit-namespace']).toBe('run-1');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.request).toMatchObject({
      method: 'POST',
      url: `http://127.0.0.1:${address.port}/users`,
      headers: { 'x-node-test-kit-namespace': 'run-1' },
      body: { name: 'Ada' }
    });
    expect(seen[0]?.response).toMatchObject({
      statusCode: 201,
      json: { created: true }
    });
  });
});
