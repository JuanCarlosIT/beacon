import { requestRepository } from '../repositories/request.repository.js';
import {
  requestSchema,
  executionSchema,
  canTransition,
  DECISION_STATUSES,
} from '../models/request.validation.js';
import { ownerScope, requestToDto, matchesSubmission } from '../models/request.model.js';
import { resolveCatalogSelection, resolvePurchaseSelection } from '../models/catalog.model.js';
import { catalogService } from './catalog.service.js';
import { ensure, required } from '../errors/HttpError.js';
import { purchaseOrderService } from './purchase-order.service.js';
import { hasVerifiedRole, canDecideRequest, decisionActor } from '../models/access.model.js';
import { config } from '../config/env.js';
import { getN8nAvailability } from '../integrations/n8n/n8nApproval.client.js';

const NOT_FOUND = 'Solicitud no encontrada.';
const CHANGED_SUBMISSION = 'Esta captura cambió. Actualiza antes de volver a registrarla.';
const NOTICE_ROLES = ['admin', 'solicitante'];

// Hoy como AAAA-MM-DD en la zona horaria del servidor.
const today = () => new Intl.DateTimeFormat('en-CA').format(new Date());

const selectionFor = (catalog, values) => ({
  ...resolveCatalogSelection(catalog, values.odooPlotId, values.hectares),
  ...resolvePurchaseSelection(catalog, values.odooSupplierId, values.applicationPeriodCode),
});

export function createRequestService(
  repository = requestRepository,
  readCatalog = () => catalogService.list(),
  approvalsEnabled = () => getN8nAvailability().enabled,
  demoApprovals = () => config.demoApprovals,
) {
  const canDecideTo = (user, row, status) =>
    canDecideRequest(user, demoApprovals()) && canTransition(user.role, row.status, status);

  const permissionsFor = (row, user) => ({
    canApprove: canDecideTo(user, row, 'Aprobada'),
    canCancel: canDecideTo(user, row, 'Cancelada'),
    // Pedir aprobación no decide nada: basta con poder ver la solicitud.
    canRequestApproval:
      approvalsEnabled() && row.status === 'Solicitada' && NOTICE_ROLES.includes(user.role),
  });

  // La misma captura enviada dos veces regresa la solicitud ya guardada (si no cambió).
  async function previousSubmission(values, user) {
    if (!values.submissionKey) return null;
    const existing = await repository.findSubmission(values.submissionKey);
    if (!existing) return null;
    ensure(matchesSubmission(existing, values, user.name), 409, CHANGED_SUBMISSION);
    return requestToDto(existing);
  }

  async function createNew(values, user) {
    ensure(values.date >= today(), 422, 'La fecha requerida no puede ser anterior a hoy.');
    const selection = selectionFor(await readCatalog(), values);
    return requestToDto(await repository.create(values, selection, user.name));
  }

  return {
    async list(user) {
      return (await repository.list(ownerScope(user))).map(requestToDto);
    },

    // onCreated solo corre para una solicitud nueva (no al repetir la misma captura).
    async create(body, user, { onCreated } = {}) {
      const values = requestSchema.parse(body);
      const previous = await previousSubmission(values, user);
      if (previous) return previous;
      const created = await createNew(values, user);
      onCreated?.(created);
      return created;
    },

    async detail(id, user) {
      const row = required(await repository.find(id, ownerScope(user)), 404, NOT_FOUND);
      return {
        ...requestToDto(row),
        ...(await repository.details(id)),
        purchaseOrder: purchaseOrderService.describe(row, user),
        permissions: permissionsFor(row, user),
      };
    },

    async changeStatus(id, status, user) {
      ensure(DECISION_STATUSES.includes(status), 400, 'Estado inválido.');
      ensure(
        canDecideRequest(user, demoApprovals()),
        403,
        'Solo un aprobador con identidad verificada puede cambiar este estado.',
      );
      const row = required(await repository.find(id), 404, NOT_FOUND);
      ensure(
        canTransition(user.role, row.status, status),
        409,
        'Cambio no permitido para este perfil o estado.',
      );
      ensure(
        await repository.changeStatus(id, row.status, status, decisionActor(user)),
        409,
        'La solicitud cambió. Actualiza e intenta de nuevo.',
      );
    },

    async execute(id, body, user) {
      ensure(
        hasVerifiedRole(user, 'admin', 'operador'),
        403,
        'Solo operaciones con identidad verificada puede registrar la ejecución.',
      );
      const values = executionSchema.parse(body);
      ensure(
        await repository.registerExecution(id, values, user.name),
        409,
        'La solicitud debe estar aprobada y sin ejecución previa.',
      );
    },
  };
}
export const requestService = createRequestService();
