import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const privateDir = path.join(root, 'backend/.docker');
const envFile = path.join(root, 'backend/.env');
const values = dotenv.parse(await fs.readFile(envFile, 'utf8'));
const localPort = Number(values.POSTGRES_LOCAL_PORT || 5434);
const task = process.argv[2];

if (
  !['up', 'status', 'stop'].includes(task) ||
  values.DB_NAME !== 'fumigaciones_pruebas' ||
  !/^[a-z_][a-z0-9_]{0,62}$/.test(values.DB_USER || '') ||
  values.DB_USER === 'postgres' ||
  !values.DB_PASSWORD ||
  /[\r\n]/.test(values.DB_PASSWORD) ||
  !Number.isInteger(localPort) ||
  localPort < 1024 ||
  localPort > 65535
) {
  console.error(
    'Revisa backend/.env: base fumigaciones_pruebas, usuario de aplicación, contraseña y puerto local válidos.',
  );
  process.exit(1);
}

async function privateFile(name, content, verify = false) {
  const filename = path.join(privateDir, name);
  try {
    await fs.writeFile(filename, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (verify && (await fs.readFile(filename, 'utf8')) !== content)
      throw new Error(
        'La contraseña configurada difiere del secreto de Docker. No se modificó ningún dato ni credencial existente.',
      );
  }
}

async function prepare() {
  await fs.mkdir(privateDir, { recursive: true, mode: 0o700 });
  await privateFile('postgres-admin-password', randomBytes(36).toString('base64url'));
  await privateFile('postgres-app-password', values.DB_PASSWORD, true);
  if (
    Number(values.DB_PORT || 5433) !== localPort ||
    !['127.0.0.1', 'localhost'].includes(values.DB_HOST)
  ) {
    await privateFile(
      'source-database.json',
      JSON.stringify(
        {
          host: values.DB_HOST || '127.0.0.1',
          port: Number(values.DB_PORT || 5433),
          database: values.DB_NAME,
          user: values.DB_USER,
          password: values.DB_PASSWORD,
        },
        null,
        2,
      ),
    );
  }
}

async function compose(args) {
  const child = spawn(
    process.platform === 'win32' ? 'docker.exe' : 'docker',
    ['compose', '--env-file', envFile, '-f', path.join(root, 'compose.yaml'), ...args],
    { cwd: root, stdio: 'inherit' },
  );
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0)
    throw new Error('Docker no pudo completar la operación. No se cambió la conexión del backend.');
}

async function status() {
  const pool = new pg.Pool({
    host: '127.0.0.1',
    port: localPort,
    database: values.DB_NAME,
    user: values.DB_USER,
    password: values.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
    max: 1,
  });
  try {
    const result =
      await pool.query(`SELECT current_database() AS database, current_user AS app_user,
      (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS tables`);
    console.log(JSON.stringify({ host: '127.0.0.1', port: localPort, ...result.rows[0] }));
  } finally {
    await pool.end();
  }
}

try {
  if (task === 'up') {
    await prepare();
    await compose(['up', '-d', '--wait', '--wait-timeout', '120', 'postgres']);
    await status();
    console.log(
      'PostgreSQL local listo. No se cambió la conexión activa ni se importaron registros automáticamente.',
    );
  } else if (task === 'stop') {
    await compose(['stop', 'postgres']);
  } else {
    await status();
  }
} catch (error) {
  console.error(error.code ? `PostgreSQL local: ${error.code}` : error.message);
  process.exitCode = 1;
}
