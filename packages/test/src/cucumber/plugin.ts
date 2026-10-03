import { randomUUID } from 'node:crypto';
import { closeSync, openSync, writeSync } from 'node:fs';
import type { Envelope, Pickle, TestCase } from '@cucumber/messages';

interface PluginContext {
  readonly operation: 'loadSources' | 'loadSupport' | 'runCucumber';
  readonly on: (event: 'message', handler: (envelope: Envelope) => void) => void;
  readonly logger: { error(message: string): void };
}

interface ScenarioInfo {
  readonly name: string;
  readonly uri: string;
  readonly line: number;
  readonly tags: string[];
}

interface CucumberPlugin {
  readonly type: 'plugin';
  readonly coordinator: (context: PluginContext) => void | (() => void);
}

interface SourceLocation { readonly uri: string; readonly line: number }

interface ScenarioState {
  readonly id: string;
  readonly info: ScenarioInfo;
  readonly startedAt: number;
  status: string;
}

const STATUS_RANK: Readonly<Record<string, number>> = {
  FAILED: 6,
  AMBIGUOUS: 5,
  UNDEFINED: 4,
  PENDING: 3,
  SKIPPED: 2,
  UNKNOWN: 1,
  PASSED: 0
};

/** Emits metadata-only scenario lifecycle events; no step arguments or attachments are serialized. */
const xqCucumberPlugin: CucumberPlugin = {
  type: 'plugin',
  coordinator: ({ operation, on, logger }) => {
    if (operation !== 'runCucumber') return;
    const eventFile = process.env.XQ_CUCUMBER_EVENTS_FILE;
    if (!eventFile) return;

    let descriptor: number | undefined;
    let sinkFailed = false;
    const executionId = randomUUID();
    const pickles = new Map<string, Pickle>();
    const testCases = new Map<string, TestCase>();
    const scenarios = new Map<string, ScenarioState>();
    const sourceLocations = new Map<string, SourceLocation>();

    const writeEvent = (event: Record<string, unknown>) => {
      if (sinkFailed) return;
      try {
        descriptor ??= openSync(eventFile, 'a', 0o600);
        writeSync(descriptor, `${JSON.stringify({ schemaVersion: 1, executionId, ...event })}\n`);
      } catch (error) {
        sinkFailed = true;
        logger.error(`xq-test: Cucumber event output failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    on('message', (envelope) => {
      if (envelope.pickle) pickles.set(envelope.pickle.id, envelope.pickle);
      if (envelope.testCase) testCases.set(envelope.testCase.id, envelope.testCase);
      if (envelope.gherkinDocument?.feature) {
        collectLocations(envelope.gherkinDocument.feature.children, envelope.gherkinDocument.uri ?? '', sourceLocations);
      }
      if (envelope.testCaseStarted) {
        const started = envelope.testCaseStarted;
        const testCase = testCases.get(started.testCaseId);
        const pickle = testCase ? pickles.get(testCase.pickleId) : undefined;
        if (!pickle) return;
        const id = randomUUID();
        const info = scenarioInfo(pickle, sourceLocations);
        scenarios.set(started.id, { id, info, startedAt: Date.now(), status: 'UNKNOWN' });
        writeEvent({
          event: 'scenario.started', scenarioId: id,
          ...info, timestamp: new Date().toISOString()
        });
      }
      if (envelope.testStepFinished) {
        const state = scenarios.get(envelope.testStepFinished.testCaseStartedId);
        const status = envelope.testStepFinished.testStepResult.status;
        if (state && (STATUS_RANK[status] ?? -1) > (STATUS_RANK[state.status] ?? -1)) state.status = status;
      }
      if (envelope.testCaseFinished) {
        const finished = envelope.testCaseFinished;
        const state = scenarios.get(finished.testCaseStartedId);
        if (!state) return;
        if (state.status === 'UNKNOWN') state.status = 'PASSED';
        writeEvent({
          event: 'scenario.finished', scenarioId: state.id,
          ...state.info, timestamp: new Date().toISOString(),
          status: state.status, durationMs: Math.max(0, Date.now() - state.startedAt)
        });
        scenarios.delete(finished.testCaseStartedId);
      }
    });

    return () => {
      if (descriptor === undefined) return;
      try { closeSync(descriptor); } catch (error) {
        logger.error(`xq-test: Cucumber event output close failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
  }
};

export default xqCucumberPlugin;

function scenarioInfo(pickle: Pickle, sourceLocations: ReadonlyMap<string, SourceLocation>): ScenarioInfo {
  const source = pickle.astNodeIds[0];
  const location = source ? sourceLocations.get(source) : undefined;
  return {
    name: pickle.name,
    uri: location?.uri ?? pickle.uri,
    line: location?.line ?? 0,
    tags: pickle.tags.map((tag) => tag.name).sort()
  };
}

function collectLocations(
  children: readonly unknown[],
  uri: string,
  locations: Map<string, SourceLocation>
): void {
  for (const item of children) {
    if (!item || typeof item !== 'object') continue;
    const child = item as {
      scenario?: { id: string; location: { line: number } };
      rule?: { children: readonly unknown[] };
    };
    if (child.scenario) locations.set(child.scenario.id, { uri, line: child.scenario.location.line });
    if (child.rule) collectLocations(child.rule.children, uri, locations);
  }
}
