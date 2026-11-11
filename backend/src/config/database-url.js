import { config } from './env.js';

// URL de conexión para Prisma a partir de las mismas variables DB_* que usa pg.
export function databaseUrl({ schema } = {}) {
  const { user, password, host, port, database } = config.database;
  const url = new URL(`postgresql://${host}:${port}/${encodeURIComponent(database)}`);
  url.username = encodeURIComponent(user);
  url.password = encodeURIComponent(password);
  if (schema) url.searchParams.set('schema', schema);
  return url.toString();
}
