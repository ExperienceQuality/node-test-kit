import { Kysely, PostgresDialect } from 'kysely';
import { Pool, type PoolConfig } from 'pg';

export interface DatabaseDescriptor {
  readonly urlEnv: string;
  readonly defaultSchema?: string;
  readonly pool?: Readonly<Pick<PoolConfig, 'max' | 'idleTimeoutMillis' | 'connectionTimeoutMillis' | 'allowExitOnIdle'>>;
}

export type DatabaseDescriptors = Readonly<Record<string, DatabaseDescriptor>>;

export type DatabaseClients<Databases> = Readonly<{
  [Name in keyof Databases]: Kysely<Databases[Name]>;
}>;

export function createDatabaseClients<Databases>(
  descriptors: DatabaseDescriptors,
  environment: NodeJS.ProcessEnv = process.env
): DatabaseClients<Databases> {
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

  return Object.freeze(Object.fromEntries(entries)) as unknown as DatabaseClients<Databases>;
}

export async function destroyDatabaseClients<Databases>(clients: DatabaseClients<Databases>): Promise<void> {
  const results = await Promise.allSettled(
    Object.values(clients as unknown as Record<string, Kysely<Record<string, never>>>).map((database) => database.destroy())
  );
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason);

  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'node-test-kit: multiple database clients failed to close');
}
