import pactum from 'pactum';

const { mock } = pactum;
const DEFAULT_NAMESPACE_HEADER = 'x-node-test-kit-namespace';

export function createStubClient({ baseUrl, namespace, namespaceHeader = DEFAULT_NAMESPACE_HEADER }) {
  if (!baseUrl) throw new Error('node-test-kit: mock server URL is not configured');
  if (!namespace) throw new Error('node-test-kit: mock namespace is required');

  mock.useRemoteServer(baseUrl);
  const owned = new Set();

  async function add(interaction) {
    const normalized = normalizeInteraction(interaction, namespaceHeader, namespace);
    const id = await mock.addInteraction(normalized);
    owned.add(id);
    return Object.freeze({ id });
  }

  async function get(id) {
    assertOwned(id, owned);
    return mock.getInteraction(id);
  }

  async function verify(id, expected = {}) {
    const interaction = await get(id);
    if (!interaction) throw new Error(`node-test-kit: interaction not found (${id})`);
    if (expected.exercised === true && !interaction.exercised) {
      throw new Error(`node-test-kit: interaction was not exercised (${id})`);
    }
    if (expected.callCount !== undefined && interaction.callCount !== expected.callCount) {
      throw new Error(`node-test-kit: interaction call count ${interaction.callCount} !== ${expected.callCount} (${id})`);
    }
    return interaction;
  }

  async function remove(id) {
    assertOwned(id, owned);
    await mock.removeInteraction(id);
    owned.delete(id);
  }

  async function clear() {
    const failures = [];
    for (const id of [...owned]) {
      try {
        await remove(id);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, 'node-test-kit: failed to clear mock interactions');
    }
  }

  return Object.freeze({
    baseUrl,
    namespace,
    namespaceHeader,
    add,
    get,
    verify,
    remove,
    clear
  });
}

function normalizeInteraction(interaction, namespaceHeader, namespace) {
  if (!interaction || typeof interaction !== 'object' || Array.isArray(interaction)) {
    throw new TypeError('node-test-kit: interaction must be an object');
  }
  if (!interaction.request || typeof interaction.request !== 'object') {
    throw new TypeError('node-test-kit: interaction.request is required');
  }

  const suppliedHeaders = interaction.request.headers ?? {};
  const reserved = Object.keys(suppliedHeaders).find((name) => name.toLowerCase() === namespaceHeader.toLowerCase());
  if (reserved && String(suppliedHeaders[reserved]) !== namespace) {
    throw new Error(`node-test-kit: ${namespaceHeader} is reserved for fixture isolation`);
  }

  return {
    ...interaction,
    request: {
      ...interaction.request,
      headers: {
        ...suppliedHeaders,
        [namespaceHeader]: namespace
      }
    }
  };
}

function assertOwned(id, owned) {
  if (typeof id !== 'string' || !owned.has(id)) {
    throw new Error(`node-test-kit: interaction is not owned by this fixture (${id ?? 'missing id'})`);
  }
}
