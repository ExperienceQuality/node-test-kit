import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublishPlan, publishPackages } from './publish-packages.mjs';

const packageRoot = new URL('..', import.meta.url).pathname;

test('plans missing packages in dependency order and skips exact versions', () => {
  const seen = new Map([
    ['@experiencequality/rest-client', '1.0.3'],
    ['@experiencequality/db', null],
    ['@experiencequality/stub', '1.0.3'],
    ['@experiencequality/core', null],
    ['@experiencequality/test', null]
  ]);

  const plan = createPublishPlan({
    packageRoot,
    version: '1.0.3',
    lookup: (name) => seen.get(name)
  });

  assert.deepEqual(plan.map(({ action, name }) => ({ action, name })), [
    { action: 'skip', name: '@experiencequality/rest-client' },
    { action: 'publish', name: '@experiencequality/db' },
    { action: 'skip', name: '@experiencequality/stub' },
    { action: 'publish', name: '@experiencequality/core' },
    { action: 'publish', name: '@experiencequality/test' }
  ]);
});

test('fails when a local package version does not match the release version', () => {
  assert.throws(
    () => createPublishPlan({ packageRoot, version: '9.9.9', lookup: () => null }),
    /expected 9\.9\.9/
  );
});

test('publishes only missing packages in plan order', () => {
  const published = [];
  publishPackages({
    packageRoot,
    version: '1.0.3',
    lookup: (name) => name === '@experiencequality/rest-client' ? '1.0.3' : null,
    publish: (item) => published.push(item.name)
  });

  assert.deepEqual(published, [
    '@experiencequality/db',
    '@experiencequality/stub',
    '@experiencequality/core',
    '@experiencequality/test'
  ]);
});
