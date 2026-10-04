import pactum from 'pactum';
import assert from 'node:assert/strict';
import type { Interaction, InteractionDetails } from 'pactum/src/exports/mock.js';

const { mock } = pactum;
const DEFAULT_NAMESPACE_HEADER = 'x-node-test-kit-namespace';

export type PactumInteraction = Interaction;
export type PactumInteractionDetails = InteractionDetails;

export type StubRequestExpectation = Partial<Pick<
  NonNullable<PactumInteraction['request']>,
  'method' | 'path' | 'queryParams' | 'headers' | 'body'
>>;

export interface StubClientOptions {
  readonly baseUrl: string | null | undefined;
  readonly namespace: string;
  readonly namespaceHeader?: string;
}

export class StubClient {
  readonly baseUrl: string;
  readonly namespace: string;
  readonly namespaceHeader: string;

  #owned = new Set<string>();

  constructor(options: StubClientOptions) {
    if (!options.baseUrl) throw new Error('node-test-kit: mock server URL is not configured');
    if (!options.namespace) throw new Error('node-test-kit: mock namespace is required');

    this.baseUrl = options.baseUrl;
    this.namespace = options.namespace;
    this.namespaceHeader = options.namespaceHeader ?? DEFAULT_NAMESPACE_HEADER;
    mock.useRemoteServer(this.baseUrl);
  }

  async addInteraction(interaction: PactumInteraction): Promise<string>;
  async addInteraction(interactions: PactumInteraction[]): Promise<string[]>;
  async addInteraction(interaction: PactumInteraction | PactumInteraction[]): Promise<string | string[]> {
    const input = Array.isArray(interaction)
      ? interaction.map((item) => this.normalize(item))
      : this.normalize(interaction);
    const result = Array.isArray(input)
      ? await mock.addInteraction(input)
      : await mock.addInteraction(input);
    const ids = Array.isArray(result) ? result : [result];
    for (const id of ids) this.#owned.add(id);
    return result as string | string[];
  }

  async getInteraction(id: string): Promise<PactumInteractionDetails>;
  async getInteraction(ids: string[]): Promise<PactumInteractionDetails[]>;
  async getInteraction(id: string | string[]): Promise<PactumInteractionDetails | PactumInteractionDetails[]> {
    this.assertOwned(id);
    return Array.isArray(id)
      ? await mock.getInteraction(id)
      : await mock.getInteraction(id);
  }

  async removeInteraction(id: string): Promise<void>;
  async removeInteraction(ids: string[]): Promise<void>;
  async removeInteraction(id: string | string[]): Promise<void> {
    this.assertOwned(id);
    if (Array.isArray(id)) await mock.removeInteraction(id);
    else await mock.removeInteraction(id);
    for (const ownedId of Array.isArray(id) ? id : [id]) this.#owned.delete(ownedId);
  }

  async clearInteractions(): Promise<void> {
    const failures: unknown[] = [];
    for (const id of [...this.#owned]) {
      try {
        await this.removeInteraction(id);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, 'node-test-kit: failed to clear mock interactions');
    }
  }

  async getCallCount(id: string): Promise<number> {
    return (await this.getInteraction(id)).callCount ?? 0;
  }

  async verifyRequest(id: string, expected: StubRequestExpectation): Promise<PactumInteractionDetails> {
    const interaction = await this.getInteraction(id);
    const request = interaction.request;
    if (expected.method !== undefined) assert.equal(request.method, expected.method);
    if (expected.path !== undefined) assert.equal(request.path, expected.path);
    if (expected.queryParams !== undefined) assert.deepEqual(request.queryParams, expected.queryParams);
    if (expected.body !== undefined) assert.deepEqual(request.body, expected.body);
    if (expected.headers !== undefined) {
      const actualHeaders = (request.headers ?? {}) as Record<string, unknown>;
      for (const [name, value] of Object.entries(expected.headers)) {
        const actualName = Object.keys(actualHeaders).find((key) => key.toLowerCase() === name.toLowerCase());
        assert.ok(actualName, `missing request header ${name}`);
        assert.deepEqual(actualHeaders[actualName], value);
      }
    }
    return interaction;
  }

  async verifyCallCount(id: string, expected: number): Promise<void> {
    assert.equal(await this.getCallCount(id), expected, `unexpected call count for interaction ${id}`);
  }

  async verifyCalled(id: string, expected = 1): Promise<void> {
    await this.verifyCallCount(id, expected);
  }

  async verifyNotCalled(id: string): Promise<void> {
    await this.verifyCallCount(id, 0);
  }

  async verifyNoUnexpectedInteractions(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pactum/interactions`);
    if (!response.ok) throw new Error(`node-test-kit: unable to inspect stub interactions (${response.status})`);
    const interactions = await response.json() as PactumInteractionDetails[];
    const unexpected = interactions.filter((interaction) => {
      const headers = interaction.request.headers ?? {};
      const namespace = Object.entries(headers).find(([name]) => name.toLowerCase() === this.namespaceHeader.toLowerCase())?.[1];
      return String(namespace) === this.namespace && !this.#owned.has(interaction.id ?? '');
    });
    assert.equal(unexpected.length, 0, `unexpected interactions for namespace ${this.namespace}`);
  }

  async assertNoUnexpectedInteraction(): Promise<void> {
    await this.verifyNoUnexpectedInteractions();
  }

  private normalize(interaction: PactumInteraction): PactumInteraction {
    if (!interaction || typeof interaction !== 'object' || Array.isArray(interaction)) {
      throw new TypeError('node-test-kit: interaction must be an object');
    }
    if (!interaction.request || typeof interaction.request !== 'object') {
      throw new TypeError('node-test-kit: interaction.request is required');
    }

    const suppliedHeaders = (interaction.request.headers ?? {}) as Record<string, unknown>;
    const reserved = Object.keys(suppliedHeaders).find(
      (name) => name.toLowerCase() === this.namespaceHeader.toLowerCase()
    );
    if (reserved && String(suppliedHeaders[reserved]) !== this.namespace) {
      throw new Error(`node-test-kit: ${this.namespaceHeader} is reserved for fixture isolation`);
    }

    return {
      ...interaction,
      request: {
        ...interaction.request,
        headers: { ...suppliedHeaders, [this.namespaceHeader]: this.namespace }
      }
    };
  }

  private assertOwned(id: string | string[]): void {
    const ids = Array.isArray(id) ? id : [id];
    for (const ownedId of ids) {
      if (!this.#owned.has(ownedId)) {
        throw new Error(`node-test-kit: interaction is not owned by this fixture (${ownedId})`);
      }
    }
  }
}

/** @deprecated Use `new StubClient(options)`. */
export function createStubClient(options: StubClientOptions): StubClient {
  return new StubClient(options);
}
