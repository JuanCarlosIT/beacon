import { prisma } from '../config/prisma.js';
import { addRequestEvent, ownedBy } from './query.helpers.js';

const attachmentData = (file, actor) => ({
  id: file.id,
  request_id: file.requestId,
  original_name: file.originalName,
  stored_name: file.storedName,
  mime_type: file.mime,
  size: file.size,
  uploaded_by: actor,
});

export function createAttachmentRepository(db = prisma) {
  return {
    create: (file, actor) =>
      db
        .$transaction(async (tx) => {
          await tx.attachment.create({ data: attachmentData(file, actor) });
          await addRequestEvent(tx, file.requestId, actor, 'Remisión adjunta');
        })
        .then(() => undefined),

    // Solo si la solicitud es del usuario (o el usuario puede ver todas).
    find: (id, owner) => db.attachment.findFirst({ where: { id, request: ownedBy(owner) } }),
  };
}

export const attachmentRepository = createAttachmentRepository();
