import { describe, expect, test, vi } from 'vitest';

import { setupPlatform } from '../src/setup.js';

describe('setupPlatform', () => {
  test('registers the platform run hook and returns config', () => {
    const on = vi.fn();
    const config = {} as Cypress.PluginConfigOptions;

    expect(setupPlatform(on, config)).toBe(config);
    expect(on).toHaveBeenCalledWith('before:run', expect.any(Function));
  });
});
