import { fileURLToPath } from 'node:url';
import type { BackendOptions } from '@xq/node-test-kit-core';
import type { DatabaseDescriptors } from '@xq/node-test-kit-db';
import type { PactumServerOptions } from '@xq/node-test-kit-stub';
import type { UserConfig } from 'vite';
import { defineConfig as defineVitestConfig, type TestUserConfig } from 'vitest/config';

export interface KitOptions {
  application?: BackendOptions;
  databases?: DatabaseDescriptors;
  mock?: PactumServerOptions;
}

export type NodeTestKitConfig = Omit<UserConfig, 'test'> & { test?: TestUserConfig } & KitOptions;

const globalSetup = fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? './global-setup.ts' : './global-setup.js', import.meta.url));

const defaultTest = {
  include: ['test/**/*.test.{js,mjs,ts,mts}'],
  environment: 'node',
  isolate: true,
  fileParallelism: true,
  maxConcurrency: 1,
  reporters: ['default']
};

export function defineConfig(options: NodeTestKitConfig = {}): UserConfig {
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
  } as unknown as UserConfig);
}
