import { Router } from 'express';
import { requestController } from '../controllers/request.controller.js';
import { attachmentController } from '../controllers/attachment.controller.js';
import { allowRoles } from '../middleware/auth.middleware.js';
import { validateId, uploadSingleFile } from '../middleware/security.middleware.js';
import { PURCHASE_ROLES } from '../services/purchase-order.service.js';

export const requestRoutes = Router();
requestRoutes.get('/', requestController.list);
requestRoutes.post('/', allowRoles('admin', 'solicitante'), requestController.create);
requestRoutes.get('/:id', validateId, requestController.detail);
requestRoutes.post(
  '/:id/purchase-order',
  validateId,
  allowRoles(...PURCHASE_ROLES),
  requestController.createPurchaseOrder,
);
requestRoutes.post(
  '/:id/approval-notice',
  validateId,
  allowRoles('admin', 'solicitante'),
  requestController.sendApprovalNotice,
);
requestRoutes.patch(
  '/:id/status',
  validateId,
  allowRoles('admin', 'aprobador'),
  requestController.changeStatus,
);
requestRoutes.post(
  '/:id/execution',
  validateId,
  allowRoles('admin', 'operador'),
  requestController.execute,
);
requestRoutes.post(
  '/:id/attachments',
  validateId,
  allowRoles('admin', 'operador'),
  uploadSingleFile,
  attachmentController.upload,
);
