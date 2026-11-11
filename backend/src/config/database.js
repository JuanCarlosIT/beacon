import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './env.js';
import { prisma } from './prisma.js';

// pg queda solo para aplicar database/schema.sql (DDL idempotente) y el chequeo de salud.
// Los datos se leen y escriben con Prisma desde los repositorios.
export const pool = new pg.Pool(config.database);

export const closeDatabase = () => Promise.all([pool.end(), prisma.$disconnect()]);
let ready = false;
let pending;
pool.on('error', () => {
  ready = false;
});

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureDatabase() {
  if (ready) return;
  if (!pending)
    pending = (async () => {
      if (!config.database.password)
        throw new Error('Falta configurar DB_PASSWORD en backend/.env.');
      const schema = await readFile(path.join(config.backendRoot, 'database/schema.sql'), 'utf8');
      await transaction((client) => client.query(schema));
      ready = true;
    })().finally(() => {
      pending = null;
    });
  await pending;
}

export async function databaseHealth() {
  try {
    await ensureDatabase();
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    ready = false;
    console.warn('PostgreSQL no disponible:', error.code || error.name);
    return false;
  }
}
