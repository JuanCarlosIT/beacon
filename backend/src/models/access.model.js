// Solo una integración de identidad del servidor podrá establecer identityVerified.
// Los perfiles demo nunca son responsables reales de aprobar ni administrar altas.
export const hasVerifiedRole = (user, ...roles) =>
  user?.identityVerified === true && roles.includes(user.role);

// Quién decide (aprobar/rechazar): un responsable verificado o, solo con DEMO_APROBAR en
// pruebas locales, el aprobador de prueba. La identidad del perfil de prueba no cambia.
export const canDecideRequest = (user, demoApprovals = false) =>
  hasVerifiedRole(user, 'admin', 'aprobador') ||
  (demoApprovals === true && user?.demo === true && user.role === 'aprobador');

// En la auditoría, una decisión de prueba nunca se confunde con una real.
export const decisionActor = (user) => (user.demo ? `${user.name} (prueba)` : user.name);
