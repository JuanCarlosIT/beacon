import { requestService } from '../services/request.service.js';
import { purchaseOrderService } from '../services/purchase-order.service.js';
import { whatsappApprovalService } from '../services/whatsapp-approval.service.js';

export const requestController = {
  async list(req, res) {
    res.json(await requestService.list(req.session.user));
  },
  async create(req, res) {
    const user = req.session.user;
    // Al guardar una solicitud nueva se avisa solo al aprobador por WhatsApp, en segundo plano:
    // si WhatsApp falla, la solicitud queda guardada igual.
    let approvalNotice = false;
    const created = await requestService.create(req.body, user, {
      onCreated: (request) => {
        approvalNotice = whatsappApprovalService.notifyInBackground(request.id, user);
      },
    });
    res.status(201).json({ ...created, approvalNotice });
  },
  async detail(req, res) {
    res.json(await requestService.detail(req.params.id, req.session.user));
  },
  async changeStatus(req, res) {
    await requestService.changeStatus(req.params.id, req.body.status, req.session.user);
    res.json({ ok: true });
  },
  async execute(req, res) {
    await requestService.execute(req.params.id, req.body, req.session.user);
    res.status(201).json({ ok: true });
  },
  async sendApprovalNotice(req, res) {
    res.status(201).json(await whatsappApprovalService.sendNotice(req.params.id, req.session.user));
  },
  async createPurchaseOrder(req, res) {
    const result = await purchaseOrderService.create(req.params.id, req.session.user);
    res.status(result.created ? 201 : 200).json(result);
  },
};
