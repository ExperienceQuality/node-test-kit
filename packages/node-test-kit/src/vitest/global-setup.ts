import { startBackend } from '@xq/node-test-kit-core';
import { startPactumServer } from '@xq/node-test-kit-stub';
import type { KitOptions } from './config.js';

interface GlobalSetupProject {
  config: { nodeTestKit?: KitOptions };
  provide<T extends string>(key: T, value: unknown): void;
}

export default async function globalSetup(project: GlobalSetupProject): Promise<() => Promise<void>> {
  const options = project.config.nodeTestKit ?? {};
  const mockServer = await startPactumServer(options.mock);
  let backend = null;
  try {
    backend = options.application?.command
      ? await startBackend({
        ...options.application,
        env: { ...options.application.env, NODE_TEST_KIT_STUB_URL: mockServer.url }
      })
      : null;
  } catch (error) {
    await mockServer.stop();
    throw error;
  }

  project.provide('nodeTestKit', {
    mock: {
      baseUrl: mockServer.url,
      host: mockServer.host,
      port: mockServer.port,
      managementUrl: mockServer.managementUrl,
      namespaceHeader: mockServer.namespaceHeader
    },
    backendUrl: backend?.url ?? options.application?.url ?? null
  });

  return async function globalTeardown() {
    try { await backend?.stop(); } finally { await mockServer.stop(); }
  };
}
