// Corre la CLI de Prisma con DATABASE_URL armada desde backend/.env (sin imprimir la contraseña).
// Solo lectura, generación y Prisma Studio; nunca migraciones (el esquema lo crea database/schema.sql).
//   node scripts/prisma.mjs db pull | generate | validate | format | studio
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { databaseUrl } from '../src/config/database-url.js';

const ALLOWED = new Set(['db', 'generate', 'validate', 'format', 'studio']);
const backendRoot = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const isReadOnly = args[0] !== 'db' || args[1] === 'pull';
if (!ALLOWED.has(args[0]) || !isReadOnly) {
  console.error(
    'Solo se permite: db pull, generate, validate, format, studio. El esquema lo crea database/schema.sql.',
  );
  process.exit(1);
}
const result = spawnSync('npx', ['prisma', ...args], {
  cwd: backendRoot,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: databaseUrl() },
});
process.exit(result.status ?? 1);
