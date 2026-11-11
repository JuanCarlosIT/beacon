import { whatsappApprovalRepository } from '../repositories/whatsapp-approval.repository.js';
import { requestRepository } from '../repositories/request.repository.js';
import { n8nApprovalClient } from '../integrations/n8n/n8nApproval.client.js';
import { folioOf, noticeHtml, noticeText, requestLink } from '../models/whatsapp-approval.model.js';
import { buildNoticePdf } from '../models/notice-pdf.model.js';
import { ownerScope } from '../models/request.model.js';
import { ensure, required } from '../errors/HttpError.js';

// El aviso solo informa: manda texto con el link y un PDF (con diseño GAB) con todo el detalle.
// Nada de lo que se responda por WhatsApp cambia la solicitud.

// Lo mismo para todos los aprobadores: texto, PDF y HTML de respaldo (WF53 lo usa si falta el PDF).
const buildNotice = ({ request, execution, link }) => {
  const folio = folioOf(request.number);
  return {
    folio,
    text: noticeText({ request, link }),
    html: noticeHtml({ request, execution }),
    pdfBase64: buildNoticePdf({ request, execution }).toString('base64'),
    pdfName: `Solicitud_${folio}.pdf`,
  };
};

const messageFor = (notice) => (approver) => ({
  folio: notice.folio,
  phone: `521${approver.phone_last10}`,
  approver: approver.name,
  text: notice.text,
  html: notice.html,
  pdfBase64: notice.pdfBase64,
  pdfName: notice.pdfName,
});

const describeFailure = (error) =>
  error.status ? [error.status, error.message] : [error.name, ''];

export function createWhatsappApprovalService({
  repository = whatsappApprovalRepository,
  requests = requestRepository,
  client = n8nApprovalClient,
  appUrl = () => process.env.APP_PUBLIC_URL || 'http://127.0.0.1:5173',
} = {}) {
  // Solicitud propia (o cualquiera si es aprobador/admin) y todavía pendiente.
  const loadPendingRequest = async (requestId, user) => {
    const request = required(
      await requests.find(requestId, ownerScope(user)),
      404,
      'Solicitud no encontrada.',
    );
    ensure(
      request.status === 'Solicitada',
      409,
      'Solo se avisa de solicitudes en estado Solicitada.',
    );
    return request;
  };

  const loadApprovers = async () => {
    const approvers = await repository.activeApprovers();
    ensure(approvers.length > 0, 503, 'Todavía no hay un aprobador registrado.');
    return approvers;
  };

  return {
    async sendNotice(requestId, user) {
      ensure(client.enabled(), 503, 'Los avisos por WhatsApp no están habilitados.');
      const request = await loadPendingRequest(requestId, user);
      const approvers = await loadApprovers();
      const { execution } = await requests.details(request.id);
      const notice = buildNotice({ request, execution, link: requestLink(appUrl(), request.id) });

      await client.notify(approvers.map(messageFor(notice)));

      const names = approvers.map((approver) => approver.name);
      await repository.recordNotice(request.id, user.name, names);
      return { folio: notice.folio, approvers: names };
    },

    // Aviso automático al guardar: no bloquea ni hace fallar el guardado.
    notifyInBackground(requestId, user, log = console) {
      if (!client.enabled()) return false;
      this.sendNotice(requestId, user).catch((error) =>
        log.warn('Aviso automático por WhatsApp falló:', ...describeFailure(error)),
      );
      return true;
    },
  };
}

export const whatsappApprovalService = createWhatsappApprovalService();
