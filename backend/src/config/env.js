import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(backendRoot, '.env') });

export const config = {
  port: Number(process.env.PORT || 3001),
  production: process.env.NODE_ENV === 'production',
  implicitDemo: process.env.IMPLICIT_DEMO_AUTH === 'true',
  // Solo pruebas locales: el aprobador de prueba puede aprobar/rechazar (queda marcado «(prueba)»).
  demoApprovals: process.env.IMPLICIT_DEMO_AUTH === 'true' && process.env.DEMO_APROBAR === 'true',
  sessionSecret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  backendRoot,
  uploadDir: path.join(backendRoot, 'storage/uploads'),
  frontendDist: path.resolve(backendRoot, '../frontend/dist'),
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5434),
    database: process.env.DB_NAME || 'fumigaciones_pruebas',
    user: process.env.DB_USER || 'fumigaciones_app',
    password: process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 4000,
    max: 5,
  },
};

// Reglas que impiden arrancar con una configuración insegura: [se cumple, mensaje si no].
const SAFETY_RULES = [
  [
    config.database.database === 'fumigaciones_pruebas',
    'Esta versión está limitada a fumigaciones_pruebas.',
  ],
  [
    !(config.implicitDemo && config.production),
    'La sesión ficticia implícita no se permite en producción.',
  ],
];
const broken = SAFETY_RULES.find(([ok]) => !ok);
if (broken) throw new Error(broken[1]);
