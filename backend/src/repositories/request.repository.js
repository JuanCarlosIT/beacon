import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { matchesSubmission } from '../models/request.model.js';
import { ensure } from '../errors/HttpError.js';
import { addRequestEvent, ownedBy, plain } from './query.helpers.js';

// --- Lectura: solicitud con proveedor, periodo, subtotal y OCM ---------------------

const WITH_RELATIONS = { supplier: true, period: true, purchaseLink: true };

// El proveedor guardado al capturar (snapshot de Odoo) manda sobre el directorio local.
const supplierField = (request, supplier, key) =>
  request.odoo_catalog_snapshot?.supplier?.[key] ?? supplier?.[key] ?? null;

const estimatedSubtotal = ({ hectares, rate_per_hectare: rate }) =>
  rate == null ? null : hectares.mul(rate).toFixed(2);

const purchaseFields = (link) => ({
  purchase_order_status: link?.status ?? null,
  purchase_order_id: link?.order_id ?? null,
  purchase_order_name: link?.order_name ?? null,
  purchase_order_database: link?.database_name ?? null,
  purchase_order_review_required: link?.review_required ?? null,
});

// Fila plana con la misma forma que usan servicios, PDF, Excel y frontend.
export const toRequestRow = ({ supplier, period, purchaseLink, ...request }) =>
  plain({
    ...request,
    supplier_name: supplierField(request, supplier, 'name'),
    supplier_vat: supplierField(request, supplier, 'vat'),
    supplier_reference: supplierField(request, supplier, 'reference'),
    application_period_name: period?.name ?? null,
    estimated_subtotal: estimatedSubtotal(request),
    ...purchaseFields(purchaseLink),
  });

const executionFields = (execution) => ({
  execution_date: execution?.execution_date ?? null,
  actual_hectares: execution?.hectares ?? null,
  provider: execution?.provider ?? null,
  pilot: execution?.pilot ?? null,
  cost: execution?.cost ?? null,
});

const toReportRow = ({ execution, _count, ...request }) => ({
  ...toRequestRow(request),
  ...plain(executionFields(execution)),
  attachments: _count.attachments,
});

const findRow = async (db, where) => {
  const request = await db.request.findFirst({ where, include: WITH_RELATIONS });
  return request && toRequestRow(request);
};

// --- Alta ---------------------------------------------------------------------------

const requestData = (values, selected, actor) => ({
  id: randomUUID(),
  requested_date: new Date(values.date),
  ranch: selected.zone.name,
  lot: selected.plot.name,
  crop: selected.crop.name,
  hectares: values.hectares,
  treatment: values.treatment,
  priority: values.priority,
  notes: values.notes,
  requested_by: actor,
  odoo_plot_id: selected.record.id,
  odoo_plot_name_id: selected.plot.id,
  odoo_zone_id: selected.zone.id,
  odoo_crop_id: selected.crop.id,
  odoo_cycle_id: selected.cycle.id,
  cycle_name: selected.cycle.name,
  odoo_catalog_snapshot: { ...selected, source: 'odoo', verifiedAt: new Date().toISOString() },
  submission_key: values.submissionKey || randomUUID(),
  odoo_supplier_id: selected.supplier.id,
  application_period_code: selected.applicationPeriod.code,
  rate_per_hectare: values.ratePerHectare,
});

const CHANGED_SUBMISSION = 'Esta captura cambió. Actualiza antes de volver a registrarla.';

async function assertAuthorizedSupplier(tx, supplierId) {
  const supplier = await tx.supplier.findFirst({
    where: { odoo_partner_id: supplierId, authorized: true },
    select: { odoo_partner_id: true },
  });
  ensure(supplier, 422, 'El proveedor no está autorizado en esta aplicación.');
}

const savePeriod = (tx, { code, name }) =>
  tx.applicationPeriod.upsert({ where: { code }, create: { code, name }, update: { name } });

// La llave de captura evita duplicar por doble clic o reintento: si ya existe no se inserta nada.
const insertOnce = async (tx, data) =>
  (await tx.request.createMany({ data: [data], skipDuplicates: true })).count > 0;

async function savedRequest(tx, id, actor) {
  await addRequestEvent(tx, id, actor, 'Solicitud creada');
  return findRow(tx, { id });
}

// Otra petición ganó con la misma llave de captura: vale solo si es exactamente la misma.
async function existingSubmission(tx, values, actor) {
  const previous = await findRow(tx, { submission_key: values.submissionKey });
  ensure(previous && matchesSubmission(previous, values, actor), 409, CHANGED_SUBMISSION);
  return previous;
}

// --- Cambio de estado -----------------------------------------------------------------

// Actualizar con el estado esperado en el filtro deja la fila bloqueada hasta el final de la
// transacción: una reserva de OCM en curso y una cancelación nunca se cruzan.
const moveStatus = async (tx, id, from, to) =>
  (await tx.request.updateMany({ where: { id, status: from }, data: { status: to } })).count > 0;

async function assertNoPurchaseInProgress(tx, id) {
  const pending = await tx.purchaseLink.findFirst({
    where: { request_id: id, status: 'creating' },
    select: { request_id: true },
  });
  ensure(
    !pending,
    409,
    'La OCM está en proceso. Espera a que termine antes de cancelar la solicitud.',
  );
}

const executionData = (requestId, values, actor) => ({
  id: randomUUID(),
  request_id: requestId,
  execution_date: new Date(values.date),
  hectares: values.hectares,
  provider: values.provider,
  pilot: values.pilot,
  cost: values.cost,
  notes: values.notes,
  registered_by: actor,
});

const ATTACHMENT_FIELDS = {
  id: true,
  original_name: true,
  mime_type: true,
  size: true,
  created_at: true,
};

export function createRequestRepository(db = prisma) {
  return {
    findSubmission: (key) => findRow(db, { submission_key: key }),

    list: async (owner) =>
      (
        await db.request.findMany({
          where: ownedBy(owner),
          include: WITH_RELATIONS,
          orderBy: { created_at: 'desc' },
        })
      ).map(toRequestRow),

    find: (id, owner = null) => findRow(db, { id, ...ownedBy(owner) }),

    create: (values, selected, actor) =>
      db.$transaction(async (tx) => {
        await assertAuthorizedSupplier(tx, selected.supplier.id);
        await savePeriod(tx, selected.applicationPeriod);
        const data = requestData(values, selected, actor);
        return (await insertOnce(tx, data))
          ? savedRequest(tx, data.id, actor)
          : existingSubmission(tx, values, actor);
      }),

    async details(id) {
      const [execution, attachments] = await Promise.all([
        db.execution.findUnique({ where: { request_id: id } }),
        db.attachment.findMany({
          where: { request_id: id },
          select: ATTACHMENT_FIELDS,
          orderBy: { created_at: 'asc' },
        }),
      ]);
      return { execution: plain(execution), attachments };
    },

    // Devuelve false si el estado ya no es el esperado (otro usuario lo cambió).
    // Si la cancelación choca con una OCM en proceso, el error deshace el cambio.
    changeStatus: (id, previous, status, actor) =>
      db.$transaction(async (tx) => {
        if (!(await moveStatus(tx, id, previous, status))) return false;
        if (status === 'Cancelada') await assertNoPurchaseInProgress(tx, id);
        await addRequestEvent(tx, id, actor, `Estado: ${status}`);
        return true;
      }),

    registerExecution: (id, values, actor) =>
      db.$transaction(async (tx) => {
        if (!(await moveStatus(tx, id, 'Aprobada', 'Realizada'))) return false;
        await tx.execution.create({ data: executionData(id, values, actor) });
        await addRequestEvent(tx, id, actor, 'Aplicación realizada y registrada');
        return true;
      }),

    report: async (owner) =>
      (
        await db.request.findMany({
          where: ownedBy(owner),
          include: {
            ...WITH_RELATIONS,
            execution: true,
            _count: { select: { attachments: true } },
          },
          orderBy: { number: 'asc' },
        })
      ).map(toReportRow),
  };
}

export const requestRepository = createRequestRepository();
