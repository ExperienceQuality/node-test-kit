import { createServer } from 'node:http';
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const consumer = resolve(root, 'packages/test/test/fixtures/cucumber-consumer');
const reportPath = 'artifacts/index.html';
const report = resolve(consumer, reportPath);
const workspaceReport = resolve(root, reportPath);
const cucumber = resolve(root, 'node_modules/@cucumber/cucumber/bin/cucumber.js');
const forbiddenSentinels = ['expected-secret-sentinel'];

await rm(report, { force: true });
await rm(workspaceReport, { force: true });

const api = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end('{"ok":true}');
});

await new Promise((resolveListen, rejectListen) => {
  api.once('error', rejectListen);
  api.listen(0, '127.0.0.1', resolveListen);
});

const address = api.address();
if (!address || typeof address === 'string') {
  await closeServer(api);
  throw new Error('ci:cucumber: local API server failed to bind');
}

const result = await runCucumber(`http://127.0.0.1:${address.port}`);
await closeServer(api);
await verifyReport();
await mkdir(dirname(workspaceReport), { recursive: true });
await copyFile(report, workspaceReport);

if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}

async function runCucumber(baseUrl) {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(process.execPath, [cucumber, '--config', 'cucumber.mjs', '--tags', '@smoke'], {
      cwd: consumer,
      env: { ...process.env, XQ_TEST_BASE_URL: baseUrl },
      stdio: 'inherit'
    });
    child.once('error', rejectResult);
    child.once('close', (status, signal) => {
      resolveResult({ status, signal });
    });
  });
}

async function verifyReport() {
  let details;
  try {
    details = await stat(report);
  } catch (error) {
    throw new Error(`ci:cucumber: expected report is missing at ${reportPath}`, { cause: error });
  }
  if (!details.isFile() || details.size === 0) {
    throw new Error(`ci:cucumber: report must be a non-empty file at ${reportPath}`);
  }

  const html = await readFile(report, 'utf8');
  if (!/<html(?:\s|>)/i.test(html)) {
    throw new Error(`ci:cucumber: report at ${reportPath} is not HTML`);
  }
  for (const sentinel of forbiddenSentinels) {
    if (html.includes(sentinel)) {
      throw new Error(`ci:cucumber: report contains forbidden secret sentinel ${sentinel}`);
    }
  }

  console.log(`verified Cucumber report at ${reportPath} (${details.size} bytes)`);
}

function closeServer(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose());
  });
}
