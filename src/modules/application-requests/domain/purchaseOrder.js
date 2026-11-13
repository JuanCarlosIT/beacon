// La OCM la arma el gestor con remisiones validadas. Aquí: qué decirle a quien ve una solicitud
// y cómo se agrupan las remisiones que pueden ir juntas en una OCM.

const label = (purchase) => purchase.reference || 'OCM';

// Etapa que reporta el backend → mensaje del panel del detalle.
const STAGE_MESSAGES = {
  approval: () => 'Primero debe autorizarse la solicitud. Después se sube la remisión.',
  remission: () =>
    'Falta la remisión. Sin remisión validada no se crea la OCM; la sube quien registra remisiones.',
  review: () => 'Hay remisiones esperando que el aprobador las revise y valide.',
  ready: () => 'Hay remisiones validadas. El gestor ya puede escogerlas para crear la OCM en STAG.',
  creating: () => 'La OCM se está creando en STAG.',
  uncertain: () =>
    'La OCM quedó pendiente de verificar. El gestor debe verificarla; no se generará otra.',
  created: (purchase) =>
    purchase.needsReview
      ? `${label(purchase)} vinculada. Revisa sus datos directamente en STAG.`
      : `${label(purchase)} creada en STAG. Producción no fue modificada.`,
};

export const purchaseOrderMessage = (purchase) =>
  (STAGE_MESSAGES[purchase.stage] ?? STAGE_MESSAGES.remission)(purchase);

// Una OCM junta remisiones del mismo proveedor y periodo: así se agrupan para escoger.
const groupKey = (remission) => `${remission.supplierId}|${remission.periodCode}`;

export function groupRemissions(remissions) {
  const groups = new Map();
  for (const remission of remissions) {
    const key = groupKey(remission);
    const group = groups.get(key) ?? {
      key,
      supplierName: remission.supplierName,
      periodName: remission.periodName,
      remissions: [],
    };
    group.remissions.push(remission);
    groups.set(key, group);
  }
  return [...groups.values()];
}

// Marcar una remisión; si es de otro proveedor/periodo, la selección empieza de nuevo con ella.
export function toggleRemission(selected, remission, remissions) {
  if (selected.includes(remission.id)) return selected.filter((id) => id !== remission.id);
  const sameGroup = selected.filter((id) => {
    const other = remissions.find((item) => item.id === id);
    return other && groupKey(other) === groupKey(remission);
  });
  return [...sameGroup, remission.id];
}

export const selectionTotal = (selected, remissions) =>
  remissions
    .filter((remission) => selected.includes(remission.id))
    .reduce((sum, remission) => sum + remission.amount, 0);
