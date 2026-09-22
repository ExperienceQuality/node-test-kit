import pactum from 'pactum';

const { mock } = pactum;
const pactumMock = mock as unknown as {
  useRemoteServer(url: string): void;
  addInteraction(interaction: unknown): Promise<string>;
  getInteraction(id: string): Promise<unknown>;
  removeInteraction(id: string): Promise<void>;
};
const DEFAULT_NAMESPACE_HEADER = 'x-node-test-kit-namespace';

export interface Interaction {
  request: { headers?: Record<string, string | number | boolean>; [key: string]: unknown };
  [key: string]: unknown;
}

export interface VerificationOptions { exercised?: boolean; callCount?: number }
export interface StubClient {
  readonly baseUrl: string;
  readonly namespace: string;
  readonly namespaceHeader: string;
  add(interaction: Interaction): Promise<{ readonly id: string }>;
  get(id: string): Promise<unknown>;
  verify(id: string, expected?: VerificationOptions): Promise<unknown>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

interface PactumInteraction extends Interaction { id?: string; exercised?: boolean; callCount?: number }

export function createStubClient({ baseUrl, namespace, namespaceHeader = DEFAULT_NAMESPACE_HEADER }: { baseUrl: string | null | undefined; namespace: string; namespaceHeader?: string }): StubClient {
  if (!baseUrl) throw new Error('node-test-kit: mock server URL is not configured');
  if (!namespace) throw new Error('node-test-kit: mock namespace is required');

  pactumMock.useRemoteServer(baseUrl);
  const owned = new Set<string>();

  async function add(interaction: Interaction): Promise<{ readonly id: string }> {
    const normalized = normalizeInteraction(interaction, namespaceHeader, namespace);
    const id = await pactumMock.addInteraction(normalized);
    owned.add(id);
    return Object.freeze({ id });
  }
  async function get(id: string): Promise<unknown> {
    assertOwned(id, owned);
    return pactumMock.getInteraction(id);
  }
  async function verify(id: string, expected: VerificationOptions = {}): Promise<unknown> {
    const interaction = await get(id) as PactumInteraction | undefined;
    if (!interaction) throw new Error(`node-test-kit: interaction not found (${id})`);
    if (expected.exercised === true && !interaction.exercised) throw new Error(`node-test-kit: interaction was not exercised (${id})`);
    if (expected.callCount !== undefined && interaction.callCount !== expected.callCount) {
      throw new Error(`node-test-kit: interaction call count ${interaction.callCount} !== ${expected.callCount} (${id})`);
    }
    return interaction;
  }
  async function remove(id: string): Promise<void> {
    assertOwned(id, owned);
    await pactumMock.removeInteraction(id);
    owned.delete(id);
  }
  async function clear(): Promise<void> {
    const failures: unknown[] = [];
    for (const id of [...owned]) {
      try { await remove(id); } catch (error) { failures.push(error); }
    }
    if (failures.length > 0) throw new AggregateError(failures, 'node-test-kit: failed to clear mock interactions');
  }
  return Object.freeze({ baseUrl, namespace, namespaceHeader, add, get, verify, remove, clear });
}

function normalizeInteraction(interaction: Interaction, namespaceHeader: string, namespace: string): Interaction {
  if (!interaction || typeof interaction !== 'object' || Array.isArray(interaction)) throw new TypeError('node-test-kit: interaction must be an object');
  if (!interaction.request || typeof interaction.request !== 'object') throw new TypeError('node-test-kit: interaction.request is required');
  const suppliedHeaders = interaction.request.headers ?? {};
  const reserved = Object.keys(suppliedHeaders).find((name) => name.toLowerCase() === namespaceHeader.toLowerCase());
  if (reserved && String(suppliedHeaders[reserved]) !== namespace) throw new Error(`node-test-kit: ${namespaceHeader} is reserved for fixture isolation`);
  return {
    ...interaction,
    request: { ...interaction.request, headers: { ...suppliedHeaders, [namespaceHeader]: namespace } }
  };
}

function assertOwned(id: unknown, owned: Set<string>): asserts id is string {
  if (typeof id !== 'string' || !owned.has(id)) throw new Error(`node-test-kit: interaction is not owned by this fixture (${id ?? 'missing id'})`);
}
