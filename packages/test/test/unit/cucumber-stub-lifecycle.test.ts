import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getCucumberStubRuntime,
  startCucumberStub,
  stopCucumberStub
} from '../../src/cucumber/stub-lifecycle.js';

const envKeys = ['XQ_TEST_STUB_ENABLED', 'XQ_TEST_STUB_URL', 'XQ_TEST_STUB_PORT'] as const;

describe('Cucumber stub lifecycle', () => {
  afterEach(async () => {
    await stopCucumberStub();
    for (const key of envKeys) delete process.env[key];
  });

  it('starts one automatic local server and exposes its URL', async () => {
    const first = await startCucumberStub();
    const second = await startCucumberStub();

    expect(first?.server).toBeDefined();
    expect(second).toBe(first);
    expect(process.env.XQ_TEST_STUB_URL).toBe(first?.url);
    expect((await fetch(`${first?.url}/api/pactum/health`)).status).toBe(200);
  });

  it('does not initialize when disabled, but supports explicit scenario demand', async () => {
    process.env.XQ_TEST_STUB_ENABLED = 'false';

    expect(await startCucumberStub()).toBeUndefined();
    expect(getCucumberStubRuntime()).toBeUndefined();

    const demanded = await startCucumberStub(true);
    expect(demanded?.server).toBeDefined();
  });

  it('reports fixed-port occupation clearly', async () => {
    const occupied = createServer();
    await new Promise<void>((resolve, reject) => {
      occupied.once('error', reject);
      occupied.listen(0, '127.0.0.1', () => resolve());
    });
    const address = occupied.address();
    if (!address || typeof address === 'string') throw new Error('test server failed to bind');
    process.env.XQ_TEST_STUB_PORT = String(address.port);

    await expect(startCucumberStub()).rejects.toThrow(`configured port ${address.port}`);
    await new Promise<void>((resolve, reject) => occupied.close((error) => error ? reject(error) : resolve()));
  });
});
