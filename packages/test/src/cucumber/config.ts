import type { IConfiguration } from '@cucumber/cucumber';
import { fileURLToPath } from 'node:url';
import type { CucumberProjectConfig } from './types.js';

/** Build ordinary cucumber-js configuration while leaving selection and execution to Cucumber. */
export function defineCucumberConfig(project: CucumberProjectConfig): Pick<IConfiguration, 'paths' | 'import' | 'plugin'> {
  const steps = Array.isArray(project.steps) ? project.steps : [project.steps];
  const paths = project.paths === undefined
    ? ['features/**/*.feature']
    : Array.isArray(project.paths) ? [...project.paths] : [project.paths];

  return {
    paths,
    import: [
      fileURLToPath(new URL('./register.js', import.meta.url)),
      fileURLToPath(new URL('./bootstrap.js', import.meta.url)),
      ...steps
    ],
    plugin: ['@experiencequality/test/cucumber/plugin']
  };
}
