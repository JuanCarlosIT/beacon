import { z } from 'zod';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica una fecha válida')
  .refine((v) => {
    const parsed = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
  }, 'Indica una fecha válida');

export const requestSchema = z.object({
  date,
  submissionKey: z.string().uuid().optional(),
  odooPlotId: z.coerce.number().int().positive(),
  hectares: z.coerce.number().positive().max(100000).multipleOf(0.01),
  odooSupplierId: z.coerce.number().int().positive('Elige un proveedor de la lista.'),
  applicationPeriodCode: z.string().min(1, 'Elige un periodo de aplicación.').max(100),
  ratePerHectare: z.coerce
    .number()
    .positive('La tarifa debe ser mayor que cero.')
    .max(100000000, 'La tarifa es demasiado alta.')
    .multipleOf(0.01, 'La tarifa admite hasta dos decimales.'),
  treatment: z.string().trim().max(500).default(''),
  priority: z.enum(['Normal', 'Alta']),
  notes: z.string().trim().max(2000).default(''),
});
export const executionSchema = z.object({
  date,
  hectares: z.coerce.number().positive().max(100000),
  provider: z.string().trim().min(2).max(150),
  pilot: z.string().trim().min(2).max(150),
  cost: z.coerce.number().nonnegative().max(100000000),
  notes: z.string().trim().max(2000).default(''),
});
// Cambios de estado permitidos: destino → { quién puede, desde qué estados }.
const TRANSITIONS = {
  Aprobada: { roles: ['admin', 'aprobador'], from: ['Solicitada'] },
  Cancelada: { roles: ['admin', 'aprobador'], from: ['Solicitada', 'Aprobada'] },
};
export const DECISION_STATUSES = Object.keys(TRANSITIONS);

export function canTransition(role, from, to) {
  const rule = TRANSITIONS[to];
  return Boolean(rule) && rule.roles.includes(role) && rule.from.includes(from);
}
