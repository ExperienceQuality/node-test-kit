import type { RestClient } from '@experiencequality/rest-client';
import type { StubClient } from '@experiencequality/stub';

export interface XqScenarioConfig {
  readonly baseUrl: string;
  readonly namespaceHeader: string;
  readonly namespace: string;
  readonly stubUrl?: string;
  readonly stubNamespaceHeader?: string;
}

export interface ScenarioRunContext {
  readonly id: string;
  readonly scenarioId: string;
  readonly workerId: string;
}

export interface CucumberProjectConfig {
  readonly steps: string | readonly string[];
  readonly paths?: string | readonly string[];
}

export interface XqScenarioFramework {
  readonly api: RestClient;
  readonly rest: RestClient;
  readonly stub: StubClient;
  readonly run: ScenarioRunContext;
  readonly config: XqScenarioConfig;
}
