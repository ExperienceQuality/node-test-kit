import { describe, expect, it } from 'vitest';
import { createDatabaseClients, destroyDatabaseClients } from '../src/index.js';

interface OrdersDatabase {
  orders: { id: number; status: string };
}

describe('database clients', () => {
  it('creates frozen named Kysely clients from environment-backed descriptors', async () => {
    const clients = createDatabaseClients({
      orders: { urlEnv: 'ORDERS_DATABASE_URL', defaultSchema: 'sales', pool: { max: 1 } }
    }, { ORDERS_DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test' });

    expect(Object.isFrozen(clients)).toBe(true);
    const orders = clients.get('orders') as import('kysely').Kysely<OrdersDatabase>;
    expect(orders.selectFrom('orders').select(['id', 'status']).compile().sql)
      .toBe('select "id", "status" from "sales"."orders"');
    await destroyDatabaseClients(clients);
  });

  it('rejects lookup of an unconfigured database', async () => {
    const clients = createDatabaseClients({}, {});
    expect(() => clients.get('orders')).toThrow('node-test-kit: database "orders" is not configured');
    await destroyDatabaseClients(clients);
  });

  it('reports the database name and environment variable when configuration is missing', () => {
    expect(() => createDatabaseClients({ analytics: { urlEnv: 'ANALYTICS_DATABASE_URL' } }, {}))
      .toThrow('node-test-kit: database "analytics" requires environment variable ANALYTICS_DATABASE_URL');
  });
});
