import { prisma } from '../config/prisma.js';
import { ensure } from '../errors/HttpError.js';
import { phoneLast10 } from '../models/whatsapp-approval.model.js';
import { addRequestEvent, plain, withUniqueConflict } from './query.helpers.js';

const validApprover = (name, last10) => Boolean(last10) && String(name).trim().length >= 3;

const LIST_FIELDS = {
  id: true,
  name: true,
  phone_last10: true,
  active: true,
  registered_by: true,
  created_at: true,
  deactivated_at: true,
};
const ACTIVE_FIELDS = { id: true, name: true, phone_last10: true };
const byId = { id: 'asc' };

// Aprobadores que reciben el aviso por WhatsApp. El aviso solo informa; aprobar se hace en la app.
export function createWhatsappApprovalRepository(db = prisma) {
  const approvers = async (query) => (await db.approver.findMany(query)).map(plain);

  return {
    listApprovers: () => approvers({ select: LIST_FIELDS, orderBy: byId }),

    activeApprovers: () =>
      approvers({ where: { active: true }, select: ACTIVE_FIELDS, orderBy: byId }),

    async addApprover(name, phone, actor) {
      const last10 = phoneLast10(phone);
      ensure(validApprover(name, last10), 422, 'Indica nombre y un teléfono de 10 dígitos.');
      return withUniqueConflict(
        async () =>
          plain(
            await db.approver.create({
              data: { name: String(name).trim(), phone_last10: last10, registered_by: actor },
            }),
          ),
        'Ese teléfono ya es de un aprobador activo.',
      );
    },

    // Devuelve el aprobador desactivado, o null si no existía o ya estaba inactivo.
    deactivateApprover: (id) =>
      db.$transaction(async (tx) => {
        const where = { id: BigInt(id) };
        const { count } = await tx.approver.updateMany({
          where: { ...where, active: true },
          data: { active: false, deactivated_at: new Date() },
        });
        return count ? plain(await tx.approver.findUnique({ where })) : null;
      }),

    async recordNotice(requestId, actor, names) {
      await addRequestEvent(
        db,
        requestId,
        actor,
        `Aviso de aprobación por WhatsApp a ${names.join(', ')}`,
      );
    },
  };
}

export const whatsappApprovalRepository = createWhatsappApprovalRepository();
