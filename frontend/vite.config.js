import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Certificado local (scripts/crear-certificado.sh). Con él la app se sirve por https: los teléfonos
// con Chrome pasan a https solos y, sin certificado, la página falla con ERR_SSL_PROTOCOL_ERROR.
const certs = (name) => fileURLToPath(new URL(`./certs/${name}`, import.meta.url));
const https = existsSync(certs('app.crt'))
  ? { cert: readFileSync(certs('app.crt')), key: readFileSync(certs('app.key')) }
  : undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    https,
    // Escucha en la red local para abrir la app desde otros equipos (https://<IP de esta PC>:5173).
    // El backend sigue solo en 127.0.0.1: los demás equipos le llegan por el proxy /api de abajo.
    host: true,
    // Nombres que WhatsApp sí convierte en link: aereas.localtest.me → 127.0.0.1 (solo esta PC) y
    // aereas.<ip-con-guiones>.sslip.io → la IP de red de esta PC (link del aviso, abre en cualquier equipo).
    allowedHosts: ['aereas.localtest.me', '.sslip.io'],
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
