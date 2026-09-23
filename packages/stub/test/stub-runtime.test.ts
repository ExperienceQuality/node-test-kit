import { expect, test } from 'vitest';
import { StubClient, startPactumServer } from '../src/index.js';

test('registers, retrieves, and removes a Pactum interaction', async () => {
  const server = await startPactumServer();
  const stub = new StubClient({ baseUrl: server.url, namespace: 'runtime-test' });

  try {
    const id = await stub.addInteraction({
      request: { method: 'GET', path: '/profile' },
      response: { status: 200, body: { name: 'Ada' } }
    });

    expect((await stub.getInteraction(id)).request.path).toBe('/profile');
    await stub.removeInteraction(id);
    expect((await fetch(`${server.url}/profile`, {
      headers: { 'x-node-test-kit-namespace': 'runtime-test' }
    })).status).toBe(404);
  } finally {
    await stub.clearInteractions();
    await server.stop();
  }
});

test('matches namespaces and returns sequential responses', async () => {
  const server = await startPactumServer();
  const first = new StubClient({ baseUrl: server.url, namespace: 'worker-1' });
  const second = new StubClient({ baseUrl: server.url, namespace: 'worker-2' });

  try {
    await first.addInteraction({
      request: { method: 'GET', path: '/state' },
      response: {
        onCall: {
          0: { status: 200, body: { state: 'pending' } },
          1: { status: 200, body: { state: 'ready' } }
        }
      }
    });
    await second.addInteraction({
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
    await first.clearInteractions();
    await second.clearInteractions();
    await server.stop();
  }
});

test('returns 404 for unmatched request and honors bounded delay', async () => {
  const server = await startPactumServer();
  const stub = new StubClient({ baseUrl: server.url, namespace: 'delay-test' });

  try {
    expect((await fetch(`${server.url}/missing`, {
      headers: { 'x-node-test-kit-namespace': 'delay-test' }
    })).status).toBe(404);
    await stub.addInteraction({
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
    await stub.clearInteractions();
    await server.stop();
  }
});

test('rejects foreign ownership and exposes native call metadata', async () => {
  const server = await startPactumServer();
  const first = new StubClient({ baseUrl: server.url, namespace: 'owner-1' });
  const second = new StubClient({ baseUrl: server.url, namespace: 'owner-2' });

  try {
    const id = await first.addInteraction({
      request: { method: 'GET', path: '/owned' },
      response: { status: 200, body: { ok: true } }
    });

    await expect(second.getInteraction(id)).rejects.toThrow('not owned by this fixture');
    const response = await fetch(`${server.url}/owned`, {
      headers: { 'x-node-test-kit-namespace': 'owner-1' }
    });
    expect(response.status).toBe(200);
    const interaction = await first.getInteraction(id);
    expect(interaction.exercised).toBe(true);
    expect(interaction.callCount).toBe(1);
  } finally {
    await first.clearInteractions();
    await second.clearInteractions();
    await server.stop();
  }
});

test('rejects attempts to override the reserved namespace header', async () => {
  const server = await startPactumServer();
  const stub = new StubClient({ baseUrl: server.url, namespace: 'owner-1' });

  try {
    await expect(stub.addInteraction({
      request: {
        method: 'GET',
        path: '/unsafe',
        headers: { 'x-node-test-kit-namespace': 'owner-2' }
      },
      response: { status: 200 }
    })).rejects.toThrow('reserved for fixture isolation');
  } finally {
    await stub.clearInteractions();
    await server.stop();
  }
});
