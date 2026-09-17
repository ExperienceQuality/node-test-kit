import { defineConfig as defineVitestConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const globalSetup = fileURLToPath(new URL('./global-setup.js', import.meta.url));

const defaultTest = {
  include: ['test/**/*.test.{js,mjs,ts,mts}'],
  environment: 'node',
  isolate: true,
  fileParallelism: true,
  maxConcurrency: 1,
  reporters: ['default']
};

export function defineConfig(options = {}) {
  const { test = {}, ...kitOptions } = options;
  const userGlobalSetup = test.globalSetup
    ? Array.isArray(test.globalSetup) ? test.globalSetup : [test.globalSetup]
    : [];

  return defineVitestConfig({
    test: {
      ...defaultTest,
      ...test,
      globalSetup: [globalSetup, ...userGlobalSetup],
      nodeTestKit: kitOptions
    }
  });
}
