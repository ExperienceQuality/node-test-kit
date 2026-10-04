import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const fixture = resolve(workspace, 'packages/test/test/fixtures/cucumber-consumer');
const cucumberCli = resolve(workspace, 'node_modules/@cucumber/cucumber/bin/cucumber.js');

describe('native cucumber-js consumer', () => {
  it('writes a non-empty default HTML report relative to the consumer directory', async () => {
    const reportPath = 'artifacts/index.html';
    const api = await startApiServer();
    await removeReport(reportPath);
    try {
      const result = await runCucumber(['--name', 'submit nested order'], {
        XQ_TEST_BASE_URL: api.baseUrl
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
      const report = await readReport(reportPath);
      expect(report).toContain('Cucumber consumer');
      expect(report).toContain('submit nested order');
      expect(report).toContain('PASSED');
    } finally {
      await api.close();
      await removeReport(reportPath);
    }
  });

  it('writes a non-empty HTML report at a custom relative reportPath', async () => {
    const reportPath = 'reports/custom-cucumber.html';
    const api = await startApiServer();
    await removeReport(reportPath);
    try {
      const result = await runCucumber(['--name', 'submit nested order'], {
        XQ_TEST_BASE_URL: api.baseUrl,
        XQ_CUCUMBER_REPORT_PATH: reportPath
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
      const report = await readReport(reportPath);
      expect(report).toContain('Cucumber consumer');
      expect(report).toContain('submit nested order');
      expect(report).toContain('PASSED');
    } finally {
      await api.close();
      await removeReport(reportPath);
    }
  });

  it('uses the default HTML report when reportPath is blank', async () => {
    const reportPath = 'artifacts/index.html';
    const api = await startApiServer();
    await removeReport(reportPath);
    try {
      const result = await runCucumber(['--name', 'submit nested order'], {
        XQ_TEST_BASE_URL: api.baseUrl,
        XQ_CUCUMBER_REPORT_PATH: '   '
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
      const report = await readReport(reportPath);
      expect(report).toContain('Cucumber consumer');
      expect(report).toContain('submit nested order');
      expect(report).toContain('PASSED');
    } finally {
      await api.close();
      await removeReport(reportPath);
    }
  });

  it('writes a failed scenario report while preserving the non-zero exit status', async () => {
    const reportPath = 'reports/failed-cucumber.html';
    await removeReport(reportPath);
    try {
      const result = await runCucumber(['--tags', '@before-failure'], {
        XQ_TEST_BASE_URL: 'http://127.0.0.1:4000',
        XQ_CUCUMBER_REPORT_PATH: reportPath
      });
      expect(result.status).not.toBe(0);
      const report = await readReport(reportPath);
      expect(report).toContain('Cucumber consumer');
      expect(report).toContain('before hook failure remains failed');
      expect(report).toContain('FAILED');
    } finally {
      await removeReport(reportPath);
    }
  });

  it('keeps Cucumber selection and exit status while emitting redacted lifecycle events', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'xq-cucumber-events-'));
    const eventFile = resolve(directory, 'events.ndjson');
    const api = await startApiServer();
    try {
      const result = await runCucumber(['--tags', '@smoke', '--name', 'submit nested order'], {
        XQ_TEST_BASE_URL: api.baseUrl,
        XQ_CUCUMBER_EVENTS_FILE: eventFile
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('1 scenario');
      const events = (await readFile(eventFile, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
      expect(events).toHaveLength(2);
      expect(events.map((event) => event.event)).toEqual(['scenario.started', 'scenario.finished']);
      expect(events[0]).toMatchObject({ schemaVersion: 1, name: 'submit nested order', uri: 'features/orders.feature', line: 4, tags: ['@smoke'] });
      expect(events[1]).toMatchObject({ status: 'PASSED' });
      expect(events[1].durationMs).toBeGreaterThanOrEqual(0);
      expect(JSON.stringify(events)).not.toContain('SKU-1');
      expect(api.namespaces).toHaveLength(1);
      expect(api.namespaces[0]).toBeTruthy();
    } finally {
      await api.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('fails before application steps when scenario configuration is invalid', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'xq-cucumber-invalid-config-'));
    const eventFile = resolve(directory, 'events.ndjson');
    try {
      const result = await runCucumber(['--name', 'invalid base URL fails before steps'], {
        XQ_TEST_BASE_URL: 'not-a-url',
        XQ_CUCUMBER_EVENTS_FILE: eventFile
      });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain('XQ_TEST_BASE_URL must be a valid HTTP(S) URL');
      const events = (await readFile(eventFile, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
      expect(events.at(-1)).toMatchObject({ event: 'scenario.finished', status: 'FAILED' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('keeps parallel Cucumber worlds and lifecycle records isolated', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'xq-cucumber-parallel-'));
    const eventFile = resolve(directory, 'events.ndjson');
    const api = await startApiServer();
    try {
      const result = await runCucumber(['--tags', '@smoke', '--parallel', '2'], {
        XQ_TEST_BASE_URL: api.baseUrl,
        XQ_CUCUMBER_EVENTS_FILE: eventFile
      });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
      expect(result.stdout).toContain('2 scenarios (2 passed)');
      const events = (await readFile(eventFile, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
      const started = events.filter((event) => event.event === 'scenario.started');
      const finished = events.filter((event) => event.event === 'scenario.finished');
      expect(started).toHaveLength(2);
      expect(finished).toHaveLength(2);
      expect(new Set(started.map((event) => event.scenarioId)).size).toBe(2);
      expect(finished.every((event) => event.status === 'PASSED')).toBe(true);
      expect(api.namespaces).toHaveLength(2);
      expect(new Set(api.namespaces).size).toBe(2);
    } finally {
      await api.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('supports builder and path-scoped table assertions without repeating the request', async () => {
    const api = await startApiServer();
    try {
      const result = await runCucumber(['--tags', '@json-assertion'], { XQ_TEST_BASE_URL: api.baseUrl });
      expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
      expect(result.stdout).toContain('2 scenarios (2 passed)');
      expect(api.orderRequests).toBe(2);
    } finally {
      await api.close();
    }
  });

  it('redacts expected and actual sentinels from Cucumber failure output and lifecycle events', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'xq-cucumber-redaction-'));
    const eventFile = resolve(directory, 'events.ndjson');
    const api = await startApiServer();
    try {
      const result = await runCucumber(['--tags', '@redaction-failure'], {
        XQ_TEST_BASE_URL: api.baseUrl,
        XQ_CUCUMBER_EVENTS_FILE: eventFile,
        XQ_EXPECTED_SECRET: 'expected-secret-sentinel'
      });
      expect(result.status).not.toBe(0);
      const output = `${result.stdout}\n${result.stderr}`;
      expect(output).not.toContain('actual-secret-sentinel');
      expect(output).not.toContain('expected-secret-sentinel');
      expect(output).toContain('JSON exact assertion failed');
      const events = (await readFile(eventFile, 'utf8')).trim().split('\n').map((line) => line);
      expect(events.join('\n')).not.toContain('actual-secret-sentinel');
      expect(events.join('\n')).not.toContain('expected-secret-sentinel');
    } finally {
      await api.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('returns native Cucumber failure status for undefined steps', async () => {
    const result = await runCucumber(['--name', 'undefined step has native failure'], {
      XQ_TEST_BASE_URL: 'http://127.0.0.1:4000'
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('a step nobody has defined');
  });

  it('preserves failed Before hook status when following steps are skipped', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'xq-cucumber-before-failure-'));
    const eventFile = resolve(directory, 'events.ndjson');
    try {
      const result = await runCucumber(['--tags', '@before-failure'], {
        XQ_TEST_BASE_URL: 'http://127.0.0.1:4000',
        XQ_CUCUMBER_EVENTS_FILE: eventFile
      });
      expect(result.status).not.toBe(0);
      const events = (await readFile(eventFile, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
      expect(events.at(-1)).toMatchObject({ event: 'scenario.finished', status: 'FAILED' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

async function startApiServer(): Promise<{
  baseUrl: string;
  namespaces: string[];
  orderRequests: number;
  close: () => Promise<void>;
}> {
  const namespaces: string[] = [];
  let orderRequests = 0;
  const server = createServer((request, response) => {
    const namespace = request.headers['x-node-test-kit-namespace'];
    if (typeof namespace === 'string') namespaces.push(namespace);
    response.writeHead(200, { 'content-type': 'application/json' });
    if (request.url === '/orders/123') {
      orderRequests += 1;
      response.end('{"id":123,"customer":{"id":"cust-123","name":"Ada","email":"ada@example.test","private":"actual-secret-sentinel"},"items":[{"sku":"SKU-1","quantity":2},{"sku":"SKU-2","quantity":1}],"status":"created"}');
    } else {
      response.end('{"ok":true}');
    }
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Cucumber API test server failed to bind');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    namespaces,
    get orderRequests() { return orderRequests; },
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    })
  };
}

async function readReport(reportPath: string): Promise<string> {
  const absolutePath = resolve(fixture, reportPath);
  const report = await readFile(absolutePath, 'utf8');
  expect(report.length).toBeGreaterThan(0);
  return report;
}

async function removeReport(reportPath: string): Promise<void> {
  await rm(resolve(fixture, reportPath), { force: true });
}

function runCucumber(args: string[], extraEnvironment: Record<string, string>): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(globalThis.process.execPath, [cucumberCli, ...args], {
      cwd: fixture,
      env: { ...globalThis.process.env, ...extraEnvironment }
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => child.kill('SIGKILL'), 30_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', (error) => {
      clearTimeout(timeout);
      rejectResult(error);
    });
    child.once('close', (status) => {
      clearTimeout(timeout);
      resolveResult({ status, stdout, stderr });
    });
  });
}
