import { databaseHealth } from '../config/database.js';
import { getStagingAvailability } from '../integrations/odoo/odooStaging.config.js';
import { getN8nAvailability } from '../integrations/n8n/n8nApproval.client.js';

export async function getHealth(req, res) {
  const database = await databaseHealth();
  res.json({
    database,
    authMode: 'demo',
    purchaseOrders: getStagingAvailability(),
    whatsappApprovals: getN8nAvailability(),
    ...(!database ? { message: 'Servicio no disponible. Intenta de nuevo.' } : {}),
  });
}
