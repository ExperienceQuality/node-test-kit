import { expect, test } from 'vitest';
import { startStubServer } from '../../src/lifecycle/stub-server.js';
import { createStubClient } from '../../src/stub/stub-client.js';

test('registers, retrieves, and removes an interaction', async () => {
  const server = await startStubServer();
  const stub = createStubClient({ baseUrl: server.url, namespace: 'runtime-test' });

  try {
    const created = await stub.add({
      method: 'GET',
      path: '/profile',
      response: { status: 200, body: { name: 'Ada' } }
    });

    expect((await stub.get(created.id)).path).toBe('/profile');
    await stub.remove(created.id);
    expect((await fetch(`${server.url}/profile`)).status).toBe(404);
  } finally {
    await server.stop();
  }
});

test('matches namespaces and returns sequential responses', async () => {
  const server = await startStubServer();
  const first = createStubClient({ baseUrl: server.url, namespace: 'worker-1' });
  const second = createStubClient({ baseUrl: server.url, namespace: 'worker-2' });

  try {
    await first.add({
      method: 'GET',
      path: '/state',
      responses: [
        { status: 200, body: { state: 'pending' } },
        { status: 200, body: { state: 'ready' } }
      ]
    });
    await second.add({ method: 'GET', path: '/state', response: { status: 200, body: { state: 'isolated' } } });

    const request = (namespace) => fetch(`${server.url}/state`, {
      headers: { 'x-node-test-kit-namespace': namespace }
    });
    expect(await (await request('worker-1')).json()).toEqual({ state: 'pending' });
    expect(await (await request('worker-1')).json()).toEqual({ state: 'ready' });
    expect(await (await request('worker-2')).json()).toEqual({ state: 'isolated' });
  } finally {
    await server.stop();
  }
});

test('returns 404 for an unmatched request and honors a bounded delay', async () => {
  const server = await startStubServer();
  const stub = createStubClient({ baseUrl: server.url, namespace: 'delay-test' });

  try {
    expect((await fetch(`${server.url}/missing`)).status).toBe(404);
    await stub.add({ method: 'GET', path: '/slow', response: { status: 200, delay: 20, body: { ok: true } } });

    const started = Date.now();
    const response = await fetch(`${server.url}/slow`, {
      headers: { 'x-node-test-kit-namespace': 'delay-test' }
    });

    expect(response.status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  } finally {
    await server.stop();
  }
});
