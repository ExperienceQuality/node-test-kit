import { startStubServer } from '../lifecycle/stub-server.js';
import { startBackend } from '../lifecycle/backend-process.js';

export default async function globalSetup(project) {
  const options = project.config.nodeTestKit ?? {};
  const stubServer = await startStubServer(options.mock);
  let backend = null;
  try {
    backend = options.application?.command
      ? await startBackend({
        ...options.application,
        env: {
          ...options.application.env,
          NODE_TEST_KIT_STUB_URL: stubServer.url,
          PAYMENTS_URL: `${stubServer.url}/payments`
        }
      })
      : null;
  } catch (error) {
    await stubServer.stop();
    throw error;
  }

  project.provide('stubUrl', stubServer.url);
  project.provide('backendUrl', backend?.url ?? options.application?.url ?? null);

  return async function globalTeardown() {
    await backend?.stop();
    await stubServer.stop();
  };
}
