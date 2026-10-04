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
      plugin: ['@experiencequality/test/cucumber/plugin'],
      format: ['progress', ['html', 'artifacts/index.html']]
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

  it('keeps the HTML report mandatory while allowing its output path to be customized', () => {
    expect(defineCucumberConfig({
      steps: 'steps/**/*.ts',
      reportPath: 'reports/cucumber/latest.html'
    }).format).toEqual(['progress', ['html', 'reports/cucumber/latest.html']]);
  });

  it('falls back to the default report path when reportPath is empty', () => {
    expect(defineCucumberConfig({
      steps: 'steps/**/*.ts',
      reportPath: '  '
    }).format).toEqual(['progress', ['html', 'artifacts/index.html']]);
  });

  it.each(['/tmp/cucumber.html', 'C:\\tmp\\cucumber.html', '\\\\server\\share\\cucumber.html'])('rejects absolute report paths: %s', (reportPath) => {
    expect(() => defineCucumberConfig({ steps: 'steps/**/*.ts', reportPath })).toThrowError(
      'xq-test: reportPath must be a consumer-relative path; absolute paths are not allowed'
    );
  });

  it.each(['../cucumber.html', 'reports/../../cucumber.html', '..\\cucumber.html'])('rejects report paths that escape the consumer workspace: %s', (reportPath) => {
    expect(() => defineCucumberConfig({ steps: 'steps/**/*.ts', reportPath })).toThrowError(
      'xq-test: reportPath must stay inside the consumer workspace; path traversal is not allowed'
    );
  });
});
