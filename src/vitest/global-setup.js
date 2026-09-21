import { startBackend } from '../lifecycle/backend-process.js';
import { startPactumServer } from '../lifecycle/pactum-server.js';

export default async function globalSetup(project) {
  const options = project.config.nodeTestKit ?? {};
  const mockServer = await startPactumServer(options.mock);
  let backend = null;
  try {
    backend = options.application?.command
      ? await startBackend({
        ...options.application,
        env: {
          ...options.application.env,
          NODE_TEST_KIT_STUB_URL: mockServer.url
        }
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
    try {
      await backend?.stop();
    } finally {
      await mockServer.stop();
    }
  };
}
