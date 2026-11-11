import { config } from '../config/env.js';
import { demoUsers } from '../models/demoUsers.js';

// Solo en DEMO LOCAL: dos usuarios de prueba según la vista que los usa.
// /validar manda X-GAB-Vista: validar → «Carlos · Supervisión» (aprobador); lo demás → solicitante.
// Ninguno tiene identidad verificada, así que el aprobador de prueba ve todo pero no aprueba.
const ROLE_BY_VIEW = { validar: 'aprobador' };
const DEFAULT_ROLE = 'solicitante';

export const demoUserForView = (view) =>
  demoUsers.find((user) => user.role === (ROLE_BY_VIEW[view] ?? DEFAULT_ROLE));

export function implicitDemoSession(req, res, next) {
  if (config.implicitDemo) req.session.user = demoUserForView(req.get('x-gab-vista'));
  next();
}

export function requireSession(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  next();
}

export const allowRoles =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.session.user.role))
      return res.status(403).json({ error: 'Tu perfil no tiene permiso para esta acción.' });
    next();
  };
