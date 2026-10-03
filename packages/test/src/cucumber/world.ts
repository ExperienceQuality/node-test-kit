import { randomUUID } from 'node:crypto';
import { World, type IWorldOptions } from '@cucumber/cucumber';
import { createRestClient, type RestClient } from '@experiencequality/rest-client';
import type { ScenarioRunContext, XqScenarioConfig } from './types.js';

const NAMESPACE_HEADER = 'x-xq-test-namespace';

export class XqWorld extends World {
  readonly run: ScenarioRunContext = Object.freeze({
    id: randomUUID(),
    scenarioId: randomUUID(),
    workerId: process.env.CUCUMBER_WORKER_ID ?? 'cucumber-worker'
  });

  config!: XqScenarioConfig;
  api!: RestClient;
  rest!: RestClient;

  constructor(options: IWorldOptions) {
    super(options);
  }

  initialize(): void {
    const baseUrl = resolveBaseUrl(process.env.XQ_TEST_BASE_URL);
    this.config = Object.freeze({
      baseUrl,
      namespaceHeader: NAMESPACE_HEADER,
      namespace: this.run.id
    });
    this.rest = createRestClient({
      baseUrl,
      namespaceHeader: this.config.namespaceHeader,
      namespace: this.config.namespace
    });
    this.api = this.rest;
  }

  async close(): Promise<void> {
    // RestClient owns no sockets or external resources. Keep hook boundary for future services.
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
