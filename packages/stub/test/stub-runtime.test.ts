import { expect, test } from 'vitest';
import { createStubClient, startPactumServer } from '../src/index.js';

test('registers, retrieves, and removes an interaction', async () => {
  const server = await startPactumServer();
  const stub = createStubClient({ baseUrl: server.url, namespace: 'runtime-test' });

  try {
    const created = await stub.add({
      request: { method: 'GET', path: '/profile' },
      response: { status: 200, body: { name: 'Ada' } }
    });

    expect((await stub.get(created.id) as { request: { path: string } }).request.path).toBe('/profile');
    await stub.verify(created.id, { exercised: false, callCount: 0 });
    await stub.remove(created.id);
    expect((await fetch(`${server.url}/profile`, {
      headers: { 'x-node-test-kit-namespace': 'runtime-test' }
    })).status).toBe(404);
  } finally {
    await server.stop();
  }
});

test('matches namespaces and returns sequential responses', async () => {
  const server = await startPactumServer();
  const first = createStubClient({ baseUrl: server.url, namespace: 'worker-1' });
  const second = createStubClient({ baseUrl: server.url, namespace: 'worker-2' });

  try {
    await first.add({
      request: { method: 'GET', path: '/state' },
      response: {
        onCall: {
          0: { status: 200, body: { state: 'pending' } },
          1: { status: 200, body: { state: 'ready' } }
        }
      }
    });
    await second.add({
      request: { method: 'GET', path: '/state' },
      response: { status: 200, body: { state: 'isolated' } }
    });

    const request = (namespace: string) => fetch(`${server.url}/state`, {
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
  const server = await startPactumServer();
  const stub = createStubClient({ baseUrl: server.url, namespace: 'delay-test' });

  try {
    expect((await fetch(`${server.url}/missing`, {
      headers: { 'x-node-test-kit-namespace': 'delay-test' }
    })).status).toBe(404);
    await stub.add({
      request: { method: 'GET', path: '/slow' },
      response: { status: 200, fixedDelay: 20, body: { ok: true } }
    });

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

test('rejects foreign namespace ownership and verifies exercised calls', async () => {
  const server = await startPactumServer();
  const first = createStubClient({ baseUrl: server.url, namespace: 'owner-1' });
  const second = createStubClient({ baseUrl: server.url, namespace: 'owner-2' });

  try {
    const created = await first.add({
      request: { method: 'GET', path: '/owned' },
      response: { status: 200, body: { ok: true } }
    });

    await expect(second.get(created.id)).rejects.toThrow('not owned by this fixture');
    const response = await fetch(`${server.url}/owned`, {
      headers: { 'x-node-test-kit-namespace': 'owner-1' }
    });
    expect(response.status).toBe(200);
    await first.verify(created.id, { exercised: true, callCount: 1 });
  } finally {
    await first.clear();
    await second.clear();
    await server.stop();
  }
});

test('rejects attempts to override the reserved namespace header', async () => {
  const server = await startPactumServer();
  const stub = createStubClient({ baseUrl: server.url, namespace: 'owner-1' });

  try {
    await expect(stub.add({
      request: {
        method: 'GET',
        path: '/unsafe',
        headers: { 'x-node-test-kit-namespace': 'owner-2' }
      },
      response: { status: 200 }
    })).rejects.toThrow('reserved for fixture isolation');
  } finally {
    await stub.clear();
    await server.stop();
  }
});
