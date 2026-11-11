import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authController } from '../controllers/auth.controller.js';
import { getHealth } from '../controllers/health.controller.js';
import { listCatalogs } from '../controllers/catalog.controller.js';
import { attachmentController } from '../controllers/attachment.controller.js';
import { downloadExcel } from '../controllers/report.controller.js';
import { requireSession, allowRoles } from '../middleware/auth.middleware.js';
import { requireDatabase } from '../middleware/database.middleware.js';
import { validateId } from '../middleware/security.middleware.js';
import { requestRoutes } from './request.routes.js';
import { supplierController } from '../controllers/supplier.controller.js';

// Límite de peticiones por IP con los encabezados estándar (draft-7).
const limiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(message ? { message: { error: message } } : {}),
  });

const loginLimiter = limiter(15 * 60 * 1000, 30);
const catalogLimiter = limiter(
  60000,
  20,
  'Espera un momento antes de volver a actualizar los catálogos.',
);

export const apiRoutes = Router();

// Públicas
apiRoutes.get('/health', getHealth);
apiRoutes.get('/auth/me', authController.me);
apiRoutes.post('/auth/login', loginLimiter, authController.login);
apiRoutes.post('/auth/logout', authController.logout);

// Con sesión y base de datos
apiRoutes.use(requireSession);
apiRoutes.use(requireDatabase);
apiRoutes.get('/catalogs', catalogLimiter, listCatalogs);
apiRoutes.get('/suppliers/candidates', allowRoles('admin'), supplierController.candidates);
apiRoutes.post('/suppliers', allowRoles('admin'), supplierController.register);
apiRoutes.use('/requests', requestRoutes);
apiRoutes.get('/attachments/:id', validateId, attachmentController.download);
apiRoutes.get('/reports/excel', downloadExcel);
