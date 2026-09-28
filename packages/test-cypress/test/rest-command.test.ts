import { afterEach, describe, expect, test, vi } from 'vitest';

describe('rest command module', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test('registers platform rest command when module loads', async () => {
    const add = vi.fn();
    vi.stubGlobal('Cypress', { Commands: { add } });

    await import('../src/commands/rest.js');

    expect(add).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledWith('rest', expect.any(Function));
  });

  async function loadRestCommand() {
    const add = vi.fn();
    const response = { body: { productId: 'p-123' }, status: 201 };
    const api = vi.fn(() => ({
      then(cb: (value: typeof response) => unknown) {
        return cb(response);
      }
    }));
    const as = vi.fn(() => ({
      then(cb: () => unknown) {
        return cb();
      }
    }));
    const wrap = vi.fn(() => ({ as }));
    vi.stubGlobal('Cypress', { Commands: { add } });
    vi.stubGlobal('cy', { api, wrap });
    await import('../src/commands/rest.js');
    const rest = add.mock.calls[0]?.[1] as (...args: unknown[]) => unknown;
    return { api, as, wrap, rest };
  }

  test('forwards request args after alias to cy.api', async () => {
    const { api, as, rest } = await loadRestCommand();
    rest('createdOrder', 'POST', '/orders', { productId: 'p-123' });

    expect(api).toHaveBeenCalledWith('POST', '/orders', { productId: 'p-123' });
    expect(as).toHaveBeenCalledWith('createdOrder');
  });

  test('forwards cy.api args when no alias is given', async () => {
    const { api, wrap, rest } = await loadRestCommand();
    rest('POST', '/orders', { productId: 'p-123' });

    expect(api).toHaveBeenCalledWith('POST', '/orders', { productId: 'p-123' });
    expect(wrap).not.toHaveBeenCalled();
  });
});
