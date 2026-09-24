import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

export type DatabaseDescriptor = {
  urlEnv: string;
  defaultSchema?: string;
  pool?: {
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    allowExitOnIdle?: boolean;
  };
};

export type DatabaseOptions = { [name: string]: DatabaseDescriptor };

export type DatabaseClients = {
  get<Database = any>(name: string): Kysely<Database>;
};

const clientsByRegistry = new WeakMap<DatabaseClients, readonly Kysely<any>[]>();

export function createDatabaseClients(
  descriptors: DatabaseOptions,
  environment: NodeJS.ProcessEnv = process.env
): DatabaseClients {
  const configured = Object.entries(descriptors).map(([name, descriptor]) => {
    const connectionString = environment[descriptor.urlEnv];
    if (!connectionString) {
      throw new Error(`node-test-kit: database "${name}" requires environment variable ${descriptor.urlEnv}`);
    }

    return [name, descriptor, connectionString] as const;
  });

  const entries = configured.map(([name, descriptor, connectionString]) => {
    const pool = new Pool({ connectionString, ...descriptor.pool });
    const database = new Kysely<Record<string, never>>({
      dialect: new PostgresDialect({ pool })
    });
    return [name, descriptor.defaultSchema ? database.withSchema(descriptor.defaultSchema) : database] as const;
  });

  const clients = new Map(entries);
  const registry: DatabaseClients = Object.freeze({
    get<Database = any>(name: string): Kysely<Database> {
      const database = clients.get(name);
      if (!database) throw new Error(`node-test-kit: database "${name}" is not configured`);
      return database as Kysely<Database>;
    }
  });
  clientsByRegistry.set(registry, [...clients.values()]);
  return registry;
}

export async function destroyDatabaseClients(clients: DatabaseClients): Promise<void> {
  const results = await Promise.allSettled(
    (clientsByRegistry.get(clients) ?? []).map((database) => database.destroy())
  );
  clientsByRegistry.delete(clients);
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason);

  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'node-test-kit: multiple database clients failed to close');
}
