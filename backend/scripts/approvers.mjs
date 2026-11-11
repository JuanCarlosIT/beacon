// Registro local de quienes reciben el aviso de aprobación por WhatsApp. Se usa desde la consola de esta PC;
// no hay pantalla ni endpoint para darlos de alta mientras no exista identidad verificada.
//   node scripts/approvers.mjs list
//   node scripts/approvers.mjs add "Nombre Apellido" 6681234567
//   node scripts/approvers.mjs deactivate <id>
import { closeDatabase, ensureDatabase } from '../src/config/database.js';
import { whatsappApprovalRepository as repo } from '../src/repositories/whatsapp-approval.repository.js';

const USAGE = 'Uso: list | add "Nombre" 6681234567 | deactivate <id>';
const lastDigits = (phone) => `…${phone.slice(-4)}`;
const approverLine = (r) =>
  `#${r.id}  ${r.active ? 'activo  ' : 'inactivo'}  ${r.name}  ${lastDigits(r.phone_last10)}  (${r.registered_by})`;

async function add([name, phone]) {
  const row = await repo.addApprover(name, phone, 'Consola local');
  console.log(`Aprobador registrado: #${row.id} ${row.name} (${lastDigits(row.phone_last10)})`);
}

async function deactivate([id]) {
  const row = await repo.deactivateApprover(id);
  console.log(
    row
      ? `Aprobador #${row.id} desactivado; ya no recibirá avisos.`
      : 'No existe un aprobador activo con ese número.',
  );
}

async function list() {
  const rows = await repo.listApprovers();
  console.log(rows.length ? rows.map(approverLine).join('\n') : 'No hay aprobadores registrados.');
}

function usage() {
  console.log(USAGE);
  process.exitCode = 1;
}

// Comando → { cuándo aplica, qué hace }. Sin comando se lista.
const COMMANDS = {
  add: { valid: (args) => args.length === 2, run: add },
  deactivate: { valid: (args) => /^\d+$/.test(args[0] || ''), run: deactivate },
  list: { valid: () => true, run: list },
};

const [task, ...args] = process.argv.slice(2);
const command = COMMANDS[task || 'list'];
try {
  await ensureDatabase();
  await (command?.valid(args) ? command.run(args) : usage());
} catch (error) {
  console.error(error.status ? error.message : `Error: ${error.code || error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
