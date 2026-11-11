import { PrismaClient } from '@prisma/client';
import { databaseUrl } from './database-url.js';

// Cliente de Prisma con la misma conexión (DB_*) que el resto del backend.
// `schema` sirve a las pruebas para trabajar en un esquema aislado.
export const createPrisma = ({ schema } = {}) =>
  new PrismaClient({ datasourceUrl: databaseUrl({ schema }) });

export const prisma = createPrisma();
