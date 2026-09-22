import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = resolve(root, 'artifacts');
const packageNames = [
  '@xq/node-test-kit-api-client',
  '@xq/node-test-kit-stub',
  '@xq/node-test-kit-core',
  'node-test-kit'
];
const consumer = await mkdtemp(join(tmpdir(), 'node-test-kit-consumer-'));
const npmCache = resolve(consumer, '.npm-cache');

try {
  run('npm', ['run', 'build'], root);
  await rm(artifacts, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });

  for (const packageName of packageNames) {
    run('npm', ['pack', '--workspace', packageName, '--pack-destination', artifacts], root);
  }

  const archives = (await readdir(artifacts))
    .filter((name) => name.endsWith('.tgz'))
    .sort()
    .map((name) => resolve(artifacts, name));
  if (archives.length !== packageNames.length) {
    throw new Error(`expected ${packageNames.length} package archives, found ${archives.length}`);
  }

  await writeFile(join(consumer, 'package.json'), `${JSON.stringify({
    name: 'node-test-kit-package-smoke',
    version: '0.0.0',
    private: true,
    type: 'module'
  }, null, 2)}\n`);
  await writeFile(join(consumer, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: {
      target: 'ES2023',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      noEmit: true,
      types: ['node']
    },
    include: ['vitest.config.ts', 'test/**/*.ts']
  }, null, 2)}\n`);
  await mkdir(join(consumer, 'test'), { recursive: true });
  await writeFile(join(consumer, 'vitest.config.ts'), `import { defineConfig } from 'node-test-kit/vitest/config';

export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
`);
  await writeFile(join(consumer, 'test', 'legacy-imports.test.ts'), `import * as root from 'node-test-kit';
import { expect, test } from 'node-test-kit/vitest';
import { defineConfig } from 'node-test-kit/vitest/config';

test('loads every legacy package entrypoint from packed archives', ({ kit }) => {
  expect(root.test).toBe(test);
  expect(root.expect).toBe(expect);
  expect(root.defineConfig).toBe(defineConfig);
  expect(kit.api).toBeDefined();
  expect(defineConfig()).toBeDefined();
});
`);

  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...archives,
    'vitest@^4.0.0',
    'typescript@^5.9.0',
    '@types/node@^24.0.0'
  ], consumer);
  run(resolve(consumer, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], consumer);
  run(resolve(consumer, 'node_modules/.bin/vitest'), ['run', '--config', 'vitest.config.ts'], consumer);

  console.log(`verified ${archives.length} archives in a fresh NodeNext/Vitest consumer`);
} finally {
  await rm(consumer, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: npmCache }
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  if (result.stdout.trim()) process.stdout.write(result.stdout);
  if (result.stderr.trim()) process.stderr.write(result.stderr);
}
