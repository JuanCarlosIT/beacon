import { createApp } from './app.js';
import { config } from './config/env.js';
import { closeDatabase } from './config/database.js';

const server = createApp().listen(config.port, '127.0.0.1', () => {
  console.log(`Backend: http://127.0.0.1:${config.port}`);
  if (config.implicitDemo)
    console.warn('DEMO LOCAL: solicitante ficticio implícito. No es autenticación Odoo.');
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  // Espera las peticiones en curso antes de cerrar las conexiones de la base.
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
