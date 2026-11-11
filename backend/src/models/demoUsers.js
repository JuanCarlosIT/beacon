export const demoUsers = [
  { id: 'admin', name: 'Administración GAB', role: 'admin', email: 'admin@gab.local' },
  { id: 'solicitante', name: 'María · Campo', role: 'solicitante', email: 'campo@gab.local' },
  {
    id: 'aprobador',
    name: 'Carlos · Supervisión',
    role: 'aprobador',
    email: 'supervisor@gab.local',
  },
  { id: 'operador', name: 'Luis · Operaciones', role: 'operador', email: 'operador@gab.local' },
].map((user) => ({ ...user, identityVerified: false, demo: true }));
