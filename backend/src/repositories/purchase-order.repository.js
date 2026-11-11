import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { HttpError, ensure } from '../errors/HttpError.js';
import { addRequestEvent, ownedBy } from './query.helpers.js';

// Vínculo solicitud ↔ OCM de STAG. La reserva ('creating') evita crear dos OCM para la misma
// solicitud y bloquea la cancelación mientras Odoo responde.

const otherDatabaseError = () =>
  new HttpError(
    409,
    'Esta solicitud está vinculada a otra base STAG. Requiere revisión antes de continuar.',
  );

function assertSameDatabase(link, targetDatabase) {
  if (link.database_name !== targetDatabase) throw otherDatabaseError();
  return link;
}

const findLink = (db, requestId) =>
  db.purchaseLink.findUnique({ where: { request_id: requestId } });

const creationEvent = (order) => `OCM creada en STAG${order.name ? `: ${order.name}` : ''}`;

// Un vínculo ya guardado vale solo si es la misma base y la misma OCM.
const isSameOrder = (link, targetDatabase, order) =>
  Boolean(link) && link.database_name === targetDatabase && link.order_id === order.id;

// "Toca" la solicitud solo si sigue Aprobada: deja la fila bloqueada hasta el final de la
// transacción, así una cancelación al mismo tiempo espera (o gana y la reserva se rechaza).
const holdWhileApproved = async (tx, requestId) =>
  (
    await tx.request.updateMany({
      where: { id: requestId, status: 'Aprobada' },
      data: { status: 'Aprobada' },
    })
  ).count > 0;

const insertReservation = async (tx, requestId, targetDatabase) =>
  (
    await tx.purchaseLink.createMany({
      data: [
        {
          request_id: requestId,
          database_name: targetDatabase,
          attempt_key: randomUUID(),
          status: 'creating',
        },
      ],
      skipDuplicates: true,
    })
  ).count > 0;

// Toma la reserva para crear la OCM; si ya había vínculo, lo devuelve sin reservar.
async function reserveIn(tx, requestId, owner, targetDatabase) {
  const request = await tx.request.findFirst({
    where: { id: requestId, ...ownedBy(owner) },
    select: { id: true },
  });
  ensure(request, 404, 'Solicitud no encontrada.');
  const previous = await findLink(tx, requestId);
  if (previous) return { reserved: false, link: assertSameDatabase(previous, targetDatabase) };
  ensure(
    await holdWhileApproved(tx, requestId),
    409,
    'La solicitud debe estar aprobada antes de generar la OCM.',
  );
  const reserved = await insertReservation(tx, requestId, targetDatabase);
  return { reserved, link: assertSameDatabase(await findLink(tx, requestId), targetDatabase) };
}

const OPEN_LINK = ['creating', 'uncertain'];

async function completeIn(tx, requestId, targetDatabase, order, actor) {
  const { count } = await tx.purchaseLink.updateMany({
    where: { request_id: requestId, database_name: targetDatabase, status: { in: OPEN_LINK } },
    data: {
      status: 'created',
      order_id: order.id,
      order_name: order.name || null,
      review_required: order.needsReview !== false,
      updated_at: new Date(),
    },
  });
  const link = await findLink(tx, requestId);
  if (count) {
    await addRequestEvent(tx, requestId, actor, creationEvent(order));
    return link;
  }
  ensure(
    isSameOrder(link, targetDatabase, order),
    409,
    'No se pudo vincular la OCM. Verifica la referencia en STAG.',
  );
  return link;
}

// Solo la reserva propia y todavía en curso (misma llave de intento).
const ownReservation = (requestId, attemptKey) => ({
  request_id: requestId,
  attempt_key: attemptKey,
  status: 'creating',
});

export function createPurchaseOrderRepository(db = prisma) {
  return {
    reserve: (requestId, owner, targetDatabase) =>
      db.$transaction((tx) => reserveIn(tx, requestId, owner, targetDatabase)),

    async release(requestId, attemptKey) {
      await db.purchaseLink.deleteMany({ where: ownReservation(requestId, attemptKey) });
    },

    async markUncertain(requestId, attemptKey) {
      await db.purchaseLink.updateMany({
        where: ownReservation(requestId, attemptKey),
        data: { status: 'uncertain', updated_at: new Date() },
      });
    },

    complete: (requestId, targetDatabase, order, actor) =>
      db.$transaction((tx) => completeIn(tx, requestId, targetDatabase, order, actor)),
  };
}

export const purchaseOrderRepository = createPurchaseOrderRepository();
