import { describe, expect, it } from 'vitest';
import { defineCucumberConfig } from '../../src/cucumber/config.js';
import { fileURLToPath } from 'node:url';

describe('defineCucumberConfig', () => {
  it('returns ordinary cucumber-js config with company bootstrap and loader', () => {
    expect(defineCucumberConfig({ steps: 'features/steps/**/*.ts' })).toEqual({
      paths: ['features/**/*.feature'],
      import: [
        fileURLToPath(new URL('../../src/cucumber/register.js', import.meta.url)),
        fileURLToPath(new URL('../../src/cucumber/bootstrap.js', import.meta.url)),
        'features/steps/**/*.ts'
      ],
      plugin: ['@xq/test/cucumber/plugin']
    });
  });

  it('supports explicit feature paths and multiple step globs without changing runner selection', () => {
    expect(defineCucumberConfig({
      paths: ['acceptance/**/*.feature'],
      steps: ['acceptance/steps/**/*.ts', 'shared/steps/**/*.ts']
    })).toMatchObject({
      paths: ['acceptance/**/*.feature'],
      import: [
        fileURLToPath(new URL('../../src/cucumber/register.js', import.meta.url)),
        fileURLToPath(new URL('../../src/cucumber/bootstrap.js', import.meta.url)),
        'acceptance/steps/**/*.ts', 'shared/steps/**/*.ts'
      ]
    });
    expect(defineCucumberConfig({ steps: 'steps/**/*.ts' })).not.toHaveProperty('tags');
    expect(defineCucumberConfig({ steps: 'steps/**/*.ts' })).not.toHaveProperty('name');
    expect(defineCucumberConfig({ steps: 'steps/**/*.ts' })).not.toHaveProperty('parallel');
  });
});
