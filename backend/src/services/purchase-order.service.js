import { requestRepository } from '../repositories/request.repository.js';
import { purchaseOrderRepository } from '../repositories/purchase-order.repository.js';
import { odooPurchaseService } from '../integrations/odoo/odooPurchase.service.js';
import {
  getStagingAvailability,
  buildStagingPurchaseUrl,
} from '../integrations/odoo/odooStaging.config.js';
import { ownerScope } from '../models/request.model.js';
import { HttpError } from '../errors/HttpError.js';

// Quién puede generar la OCM en STAG: quien captura y quien aprueba (decisión del usuario 2026-11-09).
export const PURCHASE_ROLES = ['admin', 'solicitante', 'aprobador'];

const canPurchase = (user) => PURCHASE_ROLES.includes(user.role);

// La captura trae todo lo que necesita la OCM: proveedor, periodo, tarifa y referencias.
const hasPurchaseData = (row) =>
  Boolean(
    row.odoo_supplier_id &&
    row.application_period_code &&
    Number(row.rate_per_hectare) > 0 &&
    row.odoo_catalog_snapshot?.supplier,
  );

// Fila de la solicitud con el vínculo de OCM recién guardado.
const withLink = (row, link) => ({
  ...row,
  purchase_order_status: link.status,
  purchase_order_id: link.order_id,
  purchase_order_name: link.order_name,
  purchase_order_database: link.database_name,
  purchase_order_review_required: link.review_required,
});

// Antes de intentar: cada regla devuelve el error que aplica o nada.
const createRules = [
  ({ current }) =>
    !current.enabled && new HttpError(503, 'La creación de OCM en STAG no está habilitada.'),
  ({ current, row }) =>
    current.status === 'none' &&
    row.status !== 'Aprobada' &&
    new HttpError(409, 'La solicitud debe estar aprobada antes de generar la OCM.'),
  ({ current }) =>
    !current.canCreate &&
    !current.canVerify &&
    current.status !== 'created' &&
    new HttpError(
      422,
      'No se puede generar una OCM con esta captura. Revisa proveedor, periodo y tarifa.',
    ),
];
const firstFailure = (context) => createRules.map((rule) => rule(context)).find(Boolean);

const unlinkedError = () =>
  new HttpError(
    503,
    'La OCM se creó en STAG, pero falta guardar su vínculo. Usa Verificar OCM; no generes otra.',
  );
const inVerificationError = () =>
  new HttpError(
    409,
    'La OCM está en verificación. No se generará otra automáticamente; revisa STAG o vuelve a verificar más tarde.',
  );

export function createPurchaseOrderService(
  requests = requestRepository,
  links = purchaseOrderRepository,
  odoo = odooPurchaseService,
  availability = getStagingAvailability,
) {
  function linkUrl(row, enabled) {
    if (!enabled || !row.purchase_order_id) return null;
    const target = odoo.target();
    return row.purchase_order_database === target.database
      ? buildStagingPurchaseUrl(target, row.purchase_order_id)
      : null;
  }

  function describe(row, user) {
    const { enabled } = availability();
    const status = row.purchase_order_status || 'none';
    const roleAllowed = canPurchase(user);
    const authorized = enabled && roleAllowed;
    return {
      environment: 'staging',
      roleAllowed,
      enabled,
      status,
      reference: row.purchase_order_name || null,
      needsReview: Boolean(row.purchase_order_review_required),
      url: linkUrl(row, enabled),
      canCreate:
        authorized && status === 'none' && row.status === 'Aprobada' && hasPurchaseData(row),
      canVerify: authorized && ['creating', 'uncertain'].includes(status),
      requiresApproval: status === 'none' && row.status === 'Solicitada',
    };
  }

  // Si algo falla con la reserva tomada: se marca incierta si pudo crearse en STAG, si no se libera.
  async function settleReservation(id, link, { remoteCreated, writing, error }) {
    const uncertain = remoteCreated || (writing && error.uncertain !== false);
    try {
      await (uncertain
        ? links.markUncertain(id, link.attempt_key)
        : links.release(id, link.attempt_key));
    } catch {
      // La reserva persistente sigue bloqueando otra creación aunque falle la reconciliación local.
    }
  }

  async function create(id, user) {
    if (!canPurchase(user)) throw new HttpError(403, 'No tienes permiso para generar esta OCM.');
    const row = await requests.find(id, ownerScope(user));
    if (!row) throw new HttpError(404, 'Solicitud no encontrada.');
    const failure = firstFailure({ current: describe(row, user), row });
    if (failure) throw failure;

    const { database } = odoo.target();
    const { reserved, link } = await links.reserve(id, ownerScope(user), database);
    const result = (saved, created) => ({
      purchaseOrder: describe(withLink(row, saved), user),
      created,
    });
    if (link.status === 'created') return result(link, false);

    const progress = { writing: false, remoteCreated: false };
    const save = async (order, created) => {
      progress.remoteCreated = true;
      return result(await links.complete(id, database, order, user.name), created);
    };
    try {
      const previous = await odoo.findExisting(id);
      if (previous) return await save(previous, false);
      if (!reserved) throw inVerificationError();
      const values = await odoo.prepare(row);
      progress.writing = true;
      return await save(await odoo.createDraft(values), true);
    } catch (error) {
      if (reserved) await settleReservation(id, link, { ...progress, error });
      throw progress.remoteCreated ? unlinkedError() : error;
    }
  }

  return { describe, create };
}

export const purchaseOrderService = createPurchaseOrderService();
