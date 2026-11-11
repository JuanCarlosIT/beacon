import { Prisma } from '@prisma/client';
import { HttpError } from '../errors/HttpError.js';

// Utilidades comunes de los repositorios (Prisma).

// Prisma devuelve Decimal y BigInt; el resto de la app (y el JSON) espera lo mismo que daba pg:
// decimales como texto con 2 dígitos ('12.50') y enteros grandes como texto ('2').
const PLAIN = [
  [Prisma.Decimal.isDecimal, (value) => value.toFixed(2)],
  [(value) => typeof value === 'bigint', String],
];
const plainValue = (value) => PLAIN.find(([matches]) => matches(value))?.[1](value) ?? value;

export const plain = (row) =>
  row && Object.fromEntries(Object.entries(row).map(([key, value]) => [key, plainValue(value)]));

// Filtro "solo las del solicitante" cuando hay dueño; sin dueño, todas.
export const ownedBy = (owner) => (owner == null ? {} : { requested_by: owner });

// Evento de auditoría de la solicitud (dentro de la transacción que se le pase).
export const addRequestEvent = (db, requestId, actor, description) =>
  db.event.create({ data: { request_id: requestId, actor, description } });

// Prisma (P2002) o PostgreSQL (23505): llave única repetida → 409 con mensaje propio.
const UNIQUE_VIOLATION = new Set(['P2002', '23505']);

export async function withUniqueConflict(work, message) {
  try {
    return await work();
  } catch (error) {
    if (UNIQUE_VIOLATION.has(error.code)) throw new HttpError(409, message);
    throw error;
  }
}
