import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import pg from 'pg';
import { config } from '../../src/config/env.js';
import { createPrisma } from '../../src/config/prisma.js';

// Datos de `public` que la prueba nunca debe cambiar.
const snapshotPublic = async (client) => ({
  requests: (await client.query('SELECT * FROM public.aerial_requests ORDER BY number')).rows,
  sequence: (
    await client.query('SELECT last_value,is_called FROM public.aerial_requests_number_seq')
  ).rows[0],
  links: (await client.query('SELECT * FROM public.aerial_purchase_links ORDER BY request_id'))
    .rows,
  events: (await client.query('SELECT count(*)::int AS n FROM public.aerial_events')).rows[0].n,
});

const schemaExists = async (client, name) =>
  (await client.query('SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1', [name]))
    .rows[0].n > 0;

// Corre `work` contra un esquema nuevo `check_…` en la base de pruebas local (Docker):
// se aplica database/schema.sql, Prisma trabaja ahí y al final el esquema se borra.
// `client` (pg) sirve solo para preparar el esquema y revisar desde fuera.
export async function withIsolatedSchema(work) {
  assert.equal(config.database.host, '127.0.0.1');
  assert.equal(config.database.port, 5434);
  assert.equal(config.database.database, 'fumigaciones_pruebas');
  const pool = new pg.Pool({ ...config.database, max: 1 });
  const client = await pool.connect();
  const schemaName = `check_${randomUUID().replaceAll('-', '')}`;
  const ddl = await readFile(path.join(config.backendRoot, 'database/schema.sql'), 'utf8');
  const applySchema = () => client.query(ddl);
  let db;
  try {
    const before = await snapshotPublic(client);
    try {
      await client.query(`CREATE SCHEMA "${schemaName}"`);
      await client.query(`SET search_path TO "${schemaName}",pg_catalog`);
      await applySchema();
      db = createPrisma({ schema: schemaName });
      await work({ client, db, applySchema });
    } finally {
      await db?.$disconnect();
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
    assert.deepEqual(await snapshotPublic(client), before, 'public quedó igual');
    assert.equal(await schemaExists(client, schemaName), false, 'el esquema de prueba se borró');
  } finally {
    client.release();
    await pool.end();
  }
}
