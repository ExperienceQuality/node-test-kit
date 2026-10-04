import { randomUUID } from 'node:crypto';
import { World, type IWorldOptions } from '@cucumber/cucumber';
import { createRestClient, type RestClient } from '@experiencequality/rest-client';
import { NAMESPACE_HEADER, StubClient } from '@experiencequality/stub';
import type { ScenarioRunContext, XqScenarioConfig } from './types.js';
import { createCucumberStubClient, getCucumberStubRuntime, startCucumberStub } from './stub-lifecycle.js';

export class XqWorld extends World {
  readonly run: ScenarioRunContext = Object.freeze({
    id: randomUUID(),
    scenarioId: randomUUID(),
    workerId: process.env.CUCUMBER_WORKER_ID ?? 'cucumber-worker'
  });

  config!: XqScenarioConfig;
  api!: RestClient;
  rest!: RestClient;
  #stub: StubClient | undefined;

  constructor(options: IWorldOptions) {
    super(options);
  }

  initialize(): void {
    const baseUrl = resolveBaseUrl(process.env.XQ_TEST_BASE_URL);
    const stubRuntime = getCucumberStubRuntime();
    this.config = Object.freeze({
      baseUrl,
      namespaceHeader: NAMESPACE_HEADER,
      namespace: this.run.id,
      ...(stubRuntime ? {
        stubUrl: stubRuntime.url,
        stubNamespaceHeader: stubRuntime.namespaceHeader
      } : {})
    });
    this.rest = createRestClient({
      baseUrl,
      namespaceHeader: this.config.namespaceHeader,
      namespace: this.config.namespace
    });
    this.api = this.rest;
    this.#stub = createCucumberStubClient(this.config.namespace);
  }

  get stub(): StubClient {
    if (this.#stub) return this.#stub;
    throw new Error('node-test-kit: Cucumber stub is disabled; set XQ_TEST_STUB_ENABLED=true or XQ_TEST_STUB_URL');
  }

  async requireStub(): Promise<StubClient> {
    if (!this.#stub) {
      await startCucumberStub(true);
      const runtime = getCucumberStubRuntime();
      this.config = Object.freeze({
        ...this.config,
        ...(runtime ? {
          stubUrl: runtime.url,
          stubNamespaceHeader: runtime.namespaceHeader
        } : {})
      });
      this.#stub = createCucumberStubClient(this.config.namespace);
    }
    if (!this.#stub) throw new Error('node-test-kit: Cucumber stub could not be initialized');
    return this.#stub;
  }

  async close(): Promise<void> {
    await this.#stub?.clearInteractions();
  }
}

function resolveBaseUrl(value: string | undefined): string {
  if (!value?.trim()) throw new Error('xq-test: XQ_TEST_BASE_URL is required for Cucumber scenarios');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('xq-test: XQ_TEST_BASE_URL must be a valid HTTP(S) URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('xq-test: XQ_TEST_BASE_URL must be a valid HTTP(S) URL');
  }
  return parsed.toString().replace(/\/$/, '');
}
