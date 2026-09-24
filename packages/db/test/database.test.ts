import { describe, expect, it } from 'vitest';
import { createDatabaseClients, destroyDatabaseClients } from '../src/index.js';

interface OrdersDatabase {
  orders: { id: number; status: string };
}

describe('database clients', () => {
  it('creates frozen named Kysely clients from environment-backed descriptors', async () => {
    const clients = createDatabaseClients<{ orders: OrdersDatabase }>({
      orders: { urlEnv: 'ORDERS_DATABASE_URL', defaultSchema: 'sales', pool: { max: 1 } }
    }, { ORDERS_DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test' });

    expect(Object.keys(clients)).toEqual(['orders']);
    expect(Object.isFrozen(clients)).toBe(true);
    expect(clients.orders.selectFrom('orders').select(['id', 'status']).compile().sql)
      .toBe('select "id", "status" from "sales"."orders"');
    await destroyDatabaseClients(clients);
  });

  it('reports the database name and environment variable when configuration is missing', () => {
    expect(() => createDatabaseClients({ analytics: { urlEnv: 'ANALYTICS_DATABASE_URL' } }, {}))
      .toThrow('node-test-kit: database "analytics" requires environment variable ANALYTICS_DATABASE_URL');
  });
});
