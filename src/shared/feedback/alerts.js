import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { formatMoney } from '../formatting/formatters.js';

// El aviso se monta en <body>, fuera del módulo: didOpen le copia las variables --gab-* del tema
// y aquí se usan con su color claro como respaldo. «!» gana sobre el CSS de SweetAlert.
const alertButton =
  'min-h-11 cursor-pointer rounded-[7px]! border border-transparent px-[17px] py-[11px] text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--gab-accent,#233e56)] max-[400px]:flex-1';
const alertClasses = {
  popup:
    'rounded-xl! border border-[var(--gab-line,#dad9d0)] bg-[var(--gab-surface,#fff)]! pb-6! font-sans text-[var(--gab-ink,#1c2830)]!',
  title: 'font-title text-[22px]!',
  htmlContainer: 'text-sm! leading-[1.8]! text-[var(--gab-muted,#5b6870)]!',
  actions: 'mx-[18px]! mt-[22px]! mb-0! flex flex-wrap gap-2.5 max-[400px]:w-[calc(100%-36px)]!',
  confirmButton: `${alertButton} bg-[var(--gab-accent,#233e56)] text-[var(--gab-accent-ink,#fff)]`,
  cancelButton: `${alertButton} border-[var(--gab-line,#dad9d0)] bg-[var(--gab-surface,#fff)] text-[var(--gab-ink,#1c2830)]`,
};

// Copia las variables --gab-* de `css` al aviso ya abierto.
function copyTheme(popup, css) {
  Array.from(css)
    .filter((key) => key.startsWith('--gab-'))
    .forEach((key) => popup.style.setProperty(key, css.getPropertyValue(key)));
  popup.style.colorScheme = css.colorScheme;
}

function themedAlert() {
  const root = document.querySelector('.request-module:not(.select-portal)');
  const css = root ? getComputedStyle(root) : null;
  return Swal.mixin({
    width: 'min(440px, calc(100vw - 32px))',
    heightAuto: false,
    buttonsStyling: false,
    customClass: alertClasses,
    didOpen(popup) {
      if (css) copyTheme(popup, css);
    },
  });
}

// Pregunta con Confirmar/Cancelar; regresa true solo si confirmó.
async function askConfirm({ title, text, confirmButtonText, cancelButtonText = 'Cancelar' }) {
  const result = await themedAlert().fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    focusCancel: true,
    reverseButtons: true,
  });
  return result.isConfirmed;
}

// Aviso informativo con un solo botón «Aceptar».
async function notify({ title, text, icon }) {
  await themedAlert().fire({ title, text, icon, confirmButtonText: 'Aceptar' });
}

export const confirmClear = () =>
  askConfirm({
    title: '¿Limpiar formulario?',
    text: 'Se borrará esta captura sin guardar.',
    confirmButtonText: 'Sí, limpiar',
  });

// Qué decir al guardar, según cómo quedó la solicitud. La primera regla que aplica gana.
const SAVED_RULES = [
  [
    (request) => request.status === 'Aprobada',
    (request) => [
      'Solicitud autorizada',
      `quedó autorizada al guardar. ${
        request.remissionNotice
          ? 'Se está avisando por WhatsApp a quien sube la remisión.'
          : 'Ya se puede subir su remisión.'
      }`,
    ],
  ],
  [
    (request) => request.rate_authorization === 'Pendiente',
    (request) => [
      'Solicitud registrada: falta autorizar la tarifa',
      `la tarifa es mayor a la autorizada del ciclo. ${
        request.rateNotice
          ? 'Se está avisando por WhatsApp a quien autoriza tarifas.'
          : 'Debe autorizarla quien decide tarifas.'
      }`,
    ],
  ],
  [
    (request) => request.approvalNotice === true,
    () => ['Solicitud registrada', 'se está enviando el aviso por WhatsApp al aprobador.'],
  ],
];

export function confirmSaved(request) {
  const rule = SAVED_RULES.find(([applies]) => applies(request));
  const [title, detail] = rule ? rule[1](request) : ['Solicitud registrada', ''];
  return notify({
    title,
    text: detail ? `Folio ${request.folio}: ${detail}` : `Folio ${request.folio}`,
    icon: 'success',
  });
}

export const showError = (message) =>
  notify({ title: 'No se pudo completar', text: message, icon: 'error' });

export const confirmPurchaseFromRemissions = (remissions, total) =>
  askConfirm({
    title: '¿Crear OCM en STAG?',
    text: `${remissions[0].supplierName} · ${remissions[0].periodName}. Remisiones: ${remissions
      .map((item) => item.remissionNumber)
      .join(
        ', ',
      )}. Subtotal ${formatMoney(total)} MXN sin impuestos. Se creará solo un borrador de prueba, sin confirmar la compra ni generar pagos.`,
    confirmButtonText: 'Crear borrador en STAG',
  });

export const notifyPurchaseReleased = () =>
  notify({
    title: 'No había OCM en STAG',
    text: 'Esa OCM no llegó a crearse. Sus remisiones quedaron libres para armarla de nuevo.',
    icon: 'info',
  });

const RATE_CONFIRMATION = {
  Autorizada: {
    title: '¿Autorizar esta tarifa?',
    text: (request) =>
      `${request.folio}: ${formatMoney(request.rate_per_hectare)} MXN/ha, mayor a la autorizada del ciclo${
        request.authorized_rate == null ? '' : ` (${formatMoney(request.authorized_rate)} MXN/ha)`
      }.`,
    confirmButtonText: 'Autorizar tarifa',
  },
  Rechazada: {
    title: '¿Rechazar esta tarifa?',
    text: (request) =>
      request.authorized_rate == null
        ? `${request.folio}: el ciclo no tiene tarifa autorizada, así que la solicitud se cancelará.`
        : `${request.folio}: la solicitud seguirá con la tarifa autorizada del ciclo (${formatMoney(request.authorized_rate)} MXN/ha).`,
    confirmButtonText: 'Rechazar tarifa',
  },
};

export function confirmRateDecision(request, decision) {
  const copy = RATE_CONFIRMATION[decision];
  return askConfirm({
    title: copy.title,
    text: copy.text(request),
    confirmButtonText: copy.confirmButtonText,
    cancelButtonText: 'Volver',
  });
}

export const confirmRateCorrection = (request, rate) =>
  askConfirm({
    title: '¿Corregir la tarifa?',
    text: `${request.folio}: de ${formatMoney(request.rate_per_hectare)} a ${formatMoney(rate)} MXN/ha. ${
      request.authorized_rate != null && rate <= request.authorized_rate
        ? 'Se aplica de inmediato.'
        : 'Es mayor a la autorizada del ciclo: se pedirá autorización por WhatsApp y la solicitud conserva la tarifa actual mientras tanto.'
    }`,
    confirmButtonText: 'Corregir tarifa',
    cancelButtonText: 'Volver',
  });

export const confirmRateCorrected = (saved) =>
  notify(
    saved.rate_authorization === 'Pendiente'
      ? {
          title: 'Falta autorizar la tarifa',
          text: `${saved.folio}: ${
            saved.rateNotice
              ? 'se está avisando por WhatsApp a quien autoriza tarifas.'
              : 'debe autorizarla quien decide tarifas.'
          } Mientras tanto sigue con ${formatMoney(saved.rate_per_hectare)} MXN/ha y sus remisiones no entran a una OCM.`,
          icon: 'info',
        }
      : {
          title: 'Tarifa corregida',
          text: `${saved.folio}: ahora es de ${formatMoney(saved.rate_per_hectare)} MXN/ha.`,
          icon: 'success',
        },
  );

export const confirmRemissionReview = (remission, status) =>
  askConfirm({
    title: status === 'Validada' ? '¿Validar esta remisión?' : '¿Rechazar esta remisión?',
    text:
      status === 'Validada'
        ? `Remisión ${remission.remission_number}: quedará lista para que el gestor la incluya en una OCM.`
        : `Remisión ${remission.remission_number}: no podrá entrar a ninguna OCM; habrá que subir otra.`,
    confirmButtonText: status === 'Validada' ? 'Validar remisión' : 'Rechazar remisión',
    cancelButtonText: 'Volver',
  });

export const confirmRemissionUploaded = (saved) =>
  notify({
    title: 'Remisión subida',
    text: saved.reviewNotice
      ? `Remisión ${saved.remissionNumber}. Se está avisando por WhatsApp al aprobador para que la revise.`
      : `Remisión ${saved.remissionNumber}. Falta que el aprobador la revise y valide.`,
    icon: 'success',
  });

function purchaseSavedText({ needsReview, reference }) {
  if (needsReview)
    return `Se guardó el enlace${reference ? ` a ${reference}` : ''}, pero falta verificar sus datos. Ábrela en STAG antes de continuar; no generes otra.`;
  if (reference) return `Referencia ${reference}. Puedes abrirla desde el detalle de la solicitud.`;
  return 'La OCM está creada en STAG. Puedes abrirla desde el detalle de la solicitud.';
}

export const confirmStagingPurchaseSaved = (purchaseOrder) =>
  notify({
    title: purchaseOrder.needsReview ? 'OCM vinculada; revisa sus datos' : 'OCM vinculada en STAG',
    text: purchaseSavedText(purchaseOrder),
    icon: purchaseOrder.needsReview ? 'warning' : 'success',
  });

// Textos de la confirmación según el estado al que se mueve la solicitud.
const STATUS_CONFIRMATION = {
  Aprobada: {
    title: '¿Aprobar solicitud?',
    text: (folio) =>
      `${folio}: quedará autorizada para que se suba su remisión. Autorizar no crea ni confirma una compra en Odoo.`,
    confirmButtonText: 'Aprobar solicitud',
  },
  Cancelada: {
    title: '¿Cancelar solicitud?',
    text: (folio) =>
      `${folio}: se cancelará solo la solicitud local. Esto no cancela ninguna orden existente en Odoo.`,
    confirmButtonText: 'Cancelar solicitud',
  },
};

export function confirmRequestStatus(request, status) {
  const copy = status === 'Aprobada' ? STATUS_CONFIRMATION.Aprobada : STATUS_CONFIRMATION.Cancelada;
  return askConfirm({
    title: copy.title,
    text: copy.text(request.folio),
    confirmButtonText: copy.confirmButtonText,
    cancelButtonText: 'Volver',
  });
}

export const confirmApprovalRequest = (request) =>
  askConfirm({
    title: '¿Reenviar el aviso por WhatsApp?',
    text: `${request.folio}: el aprobador registrado recibirá un aviso con el link de la solicitud y un PDF con todo el detalle. La aprobación se hace aquí en la app.`,
    confirmButtonText: 'Enviar aviso',
  });

export const confirmApprovalRequested = (result) =>
  notify({
    title: 'Aviso enviado',
    text: `${result.folio} se envió por WhatsApp a ${result.approvers.join(', ')}. El estado cambiará cuando apruebe o rechace en la app.`,
    icon: 'success',
  });

export const confirmSupplierRegistration = (supplier) =>
  askConfirm({
    title: '¿Autorizar este proveedor?',
    text: `${supplier.name} · ${supplier.vat || supplier.reference}. Se registrará únicamente en esta aplicación, con tu identidad y fecha de alta. No se modificará Odoo.`,
    confirmButtonText: 'Registrar proveedor',
  });

export const confirmSupplierRegistered = (supplier) =>
  notify({
    title: 'Proveedor registrado',
    text: `${supplier.name}. Ya está disponible; se identificará como Nuevo durante 30 días.`,
    icon: 'success',
  });
