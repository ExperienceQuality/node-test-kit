import type { IConfiguration } from '@cucumber/cucumber';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CucumberProjectConfig } from './types.js';

export const CUCUMBER_REPORT_PATH = 'artifacts/index.html';

function validateReportPath(reportPath: string): string {
  if (path.isAbsolute(reportPath) || path.posix.isAbsolute(reportPath) || path.win32.isAbsolute(reportPath) || /^[A-Za-z]:/.test(reportPath)) {
    throw new Error('xq-test: reportPath must be a consumer-relative path; absolute paths are not allowed');
  }

  let depth = 0;
  for (const segment of reportPath.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (depth === 0) {
        throw new Error('xq-test: reportPath must stay inside the consumer workspace; path traversal is not allowed');
      }
      depth -= 1;
      continue;
    }
    depth += 1;
  }

  return reportPath;
}

/** Build cucumber-js configuration with a required static HTML report. */
export function defineCucumberConfig(project: CucumberProjectConfig): Pick<IConfiguration, 'paths' | 'import' | 'plugin' | 'format'> {
  const steps = Array.isArray(project.steps) ? project.steps : [project.steps];
  const paths = project.paths === undefined
    ? ['features/**/*.feature']
    : Array.isArray(project.paths) ? [...project.paths] : [project.paths];
  const reportPath = project.reportPath?.trim()
    ? project.reportPath
    : CUCUMBER_REPORT_PATH;
  const validatedReportPath = validateReportPath(reportPath);

  return {
    paths,
    import: [
      fileURLToPath(new URL('./register.js', import.meta.url)),
      fileURLToPath(new URL('./bootstrap.js', import.meta.url)),
      ...steps
    ],
    plugin: ['@experiencequality/test/cucumber/plugin'],
    format: ['progress', ['html', validatedReportPath]]
  };
}
