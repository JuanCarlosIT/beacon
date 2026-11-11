import { z } from 'zod';
import multer from 'multer';
import { networkInterfaces } from 'node:os';
import { config } from '../config/env.js';

// IP privadas de esta PC (red de la oficina: 10.x, 172.16-31.x, 192.168.x). Con ellas se abre la app
// desde otro equipo en http://<IP>:5173 o con su nombre sslip.io (aereas.192-168-1-172.sslip.io →
// 192.168.1.172), que es el que va en el link de WhatsApp. Se leen al arrancar: si cambia la IP, reiniciar.
const privateIp = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
export function lanOrigins(interfaces = networkInterfaces(), port = 5173) {
  return Object.values(interfaces)
    .flat()
    .filter((item) => item?.family === 'IPv4' && !item.internal && privateIp.test(item.address))
    .flatMap((item) => [
      `http://${item.address}:${port}`,
      `http://aereas.${item.address.replaceAll('.', '-')}.sslip.io:${port}`,
    ]);
}

function originOf(url) {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

// La página (5173) puede servirse por http o por https (con el certificado local): se aceptan ambos.
const pageOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  // Nombre con dominio que apunta a esta PC: WhatsApp lo muestra como link (127.0.0.1 no).
  'http://aereas.localtest.me:5173',
  ...lanOrigins(),
];
const origins = new Set([
  ...pageOrigins,
  ...pageOrigins.map((origin) => origin.replace(/^http:/, 'https:')),
  `http://127.0.0.1:${config.port}`,
  `http://localhost:${config.port}`,
  // La dirección del link del aviso de WhatsApp siempre puede guardar y aprobar.
  originOf(process.env.APP_PUBLIC_URL),
  // Orígenes extra separados por coma (p. ej. otro nombre de red), si hiciera falta.
  ...(process.env.EXTRA_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]);
export function checkOrigin(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !origins.has(req.get('origin')))
    return res.status(403).json({ error: 'Origen de solicitud no permitido.' });
  next();
}
export function validateId(req, res, next) {
  if (!z.string().uuid().safeParse(req.params.id).success)
    return res.status(400).json({ error: 'Identificador inválido.' });
  next();
}
export const uploadSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
}).single('file');
