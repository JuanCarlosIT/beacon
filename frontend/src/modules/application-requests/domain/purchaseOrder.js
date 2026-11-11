// Qué mostrar en el panel de OCM del detalle, según lo que responde el backend.

const label = (purchase) => purchase.reference || 'OCM';

// La primera regla que aplica decide el mensaje; el orden es la prioridad.
const MESSAGE_RULES = [
  [
    (purchase) => purchase.status === 'created' && purchase.needsReview,
    (purchase) =>
      `${label(purchase)} vinculada. Revisa sus datos directamente en STAG; no generes otra orden.`,
  ],
  [
    (purchase) => purchase.status === 'created',
    (purchase) => `${label(purchase)} creada en STAG. Producción no fue modificada.`,
  ],
  [
    (purchase) => purchase.canVerify,
    () => 'La generación está pendiente de verificar. Se buscará la OCM existente, sin crear otra.',
  ],
  [
    (purchase) => purchase.canCreate,
    () => 'Se creará un borrador de prueba en STAG, sin confirmar compras ni generar pagos.',
  ],
  [(purchase) => !purchase.enabled, () => 'La creación de OCM en STAG no está habilitada.'],
  [
    (purchase) => purchase.roleAllowed === false,
    () => 'Tu usuario no tiene permiso para generar la OCM.',
  ],
  [
    (purchase) => purchase.requiresApproval,
    () =>
      'Pendiente de aprobación por un responsable autorizado. Después se habilitará el botón; aprobar no creará la OCM automáticamente.',
  ],
  [
    (purchase, status) => status !== 'Aprobada',
    () => 'Solo una solicitud en estado Aprobada puede generar una nueva OCM.',
  ],
];
const FALLBACK_MESSAGE =
  'Esta captura no está habilitada para generar OCM. Se requieren proveedor, periodo y tarifa completos.';

export function purchaseOrderMessage(purchase, requestStatus) {
  const rule = MESSAGE_RULES.find(([applies]) => applies(purchase, requestStatus));
  return rule ? rule[1](purchase) : FALLBACK_MESSAGE;
}

// 'link' si ya hay OCM, 'button' si se puede (o se podrá) generar/verificar, null si nada.
export function purchaseOrderAction(purchase) {
  if (purchase.url) return 'link';
  return purchase.canCreate || purchase.canVerify || purchase.requiresApproval ? 'button' : null;
}

export const purchaseOrderReady = (purchase) => Boolean(purchase.canCreate || purchase.canVerify);
