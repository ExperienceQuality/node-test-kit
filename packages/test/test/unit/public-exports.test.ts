import { describe, expect, it } from 'vitest';
import { CUCUMBER_REPORT_PATH } from '../../src/cucumber/index.js';
import { defineCucumberConfig } from '../../src/cucumber/config.js';

describe('public exports', () => {
  it('preserves the package facade', async () => {
    const kit = await import('../../src/index.js');
    expect(kit.test).toBeTypeOf('function');
    expect(kit.expect).toBeTypeOf('function');
    expect(kit.defineConfig).toBeTypeOf('function');
  });

  it('exposes the Cucumber report contract', () => {
    expect(CUCUMBER_REPORT_PATH).toBe('artifacts/index.html');
    expect(defineCucumberConfig({ steps: 'features/steps/**/*.ts' }).format)
      .toEqual(['progress', ['html', CUCUMBER_REPORT_PATH]]);
    expect(defineCucumberConfig({
      steps: 'features/steps/**/*.ts',
      reportPath: 'reports/cucumber/latest.html'
    }).format).toEqual(['progress', ['html', 'reports/cucumber/latest.html']]);
  });
});
