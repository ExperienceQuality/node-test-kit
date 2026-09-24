import { randomUUID } from 'node:crypto';
import { sql, type Generated, type Kysely } from '@xq/node-test-kit-db';
import { expect, test } from '../../src/vitest/test.js';

interface ProbeTable {
  id: Generated<number>;
  run_id: string;
  value: string;
}

interface PrimaryDatabase {
  node_test_kit_probe: ProbeTable;
}

test('queries PostgreSQL through the named typed database fixture', async ({ kit }) => {
  const schema = `node_test_kit_${randomUUID().replaceAll('-', '')}`;
  const primary = kit.db.get<PrimaryDatabase>('primary');
  await sql.raw(`create schema "${schema}"`).execute(primary);

  try {
    await sql.raw(`create table "${schema}"."node_test_kit_probe" (id bigserial primary key, run_id text not null, value text not null)`).execute(primary);
    const database = primary.withSchema(schema);
    const inserted = await database
      .insertInto('node_test_kit_probe')
      .values({ run_id: kit.run.id, value: 'connected' })
      .returning(['id', 'value'])
      .executeTakeFirstOrThrow();
    const selected = await database
      .selectFrom('node_test_kit_probe')
      .select(['id', 'run_id', 'value'])
      .where('id', '=', inserted.id)
      .executeTakeFirstOrThrow();

    expect(selected).toEqual({ id: inserted.id, run_id: kit.run.id, value: 'connected' });
  } finally {
    await sql.raw(`drop schema "${schema}" cascade`).execute(primary);
  }
});
