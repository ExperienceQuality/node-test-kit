import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = 'showcase/backend-e2e/docker-compose.yml';

if (process.argv.length !== 2) {
  throw new Error('usage: node scripts/ci-test.mjs');
}

run('npm', ['run', 'check']);
run('npm', ['test']);

try {
  run('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait']);
  run('npm', ['run', 'test:e2e']);
} finally {
  run('docker', ['compose', '-f', composeFile, 'down', '--volumes']);
}

run('npm', ['run', 'verify:packages']);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}
