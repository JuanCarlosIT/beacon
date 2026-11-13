import { useRef, useState } from 'react';
import { Camera, Check, FileText, FolderOpen, Upload, X } from 'lucide-react';
import BusyIcon from '../../../../../shared/ui/BusyIcon.jsx';
import { formatNumber } from '../../../../../shared/formatting/formatters.js';
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSuccess,
  cx,
  input,
  tag,
} from '../../../../../shared/ui/classes.js';
import { sectionClass } from './DetailSection.jsx';

const REVIEW_TONE = {
  Pendiente: 'bg-gab-warn-bg text-gab-warn',
  Validada: 'bg-gab-ok-bg text-gab-ok',
  Rechazada: 'bg-gab-bad-bg text-gab-bad',
};

const orderLabel = (order) =>
  order.status === 'created' ? `En ${order.order_name || 'una OCM'}` : 'OCM en proceso';

const compact = 'min-h-[36px] px-3 py-1.5';

function RemissionRow({ remission, canReview, busy, onReview, onOpenFile }) {
  const pending = remission.review_status === 'Pendiente';
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-gab-line py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 text-left text-gab-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gab-accent"
            title="Descargar el archivo de la remisión"
            onClick={() => onOpenFile?.(remission)}
          >
            <FileText size={14} aria-hidden="true" />
            Remisión {remission.remission_number || 'sin número'}
          </button>
          <span className={cx(tag, REVIEW_TONE[remission.review_status])}>
            {remission.review_status}
          </span>
          {remission.purchase_order && (
            <span className={tag}>{orderLabel(remission.purchase_order)}</span>
          )}
        </p>
        <p className="mt-1 text-[11px] text-gab-muted">
          {remission.hectares == null ? 'Sin hectáreas' : `${formatNumber(remission.hectares)} ha`}
          {' · '}
          {remission.uploaded_by}
          {remission.reviewed_by && ` · Revisó: ${remission.reviewed_by}`}
        </p>
      </div>
      {canReview && pending && (
        <div className="flex gap-2">
          <button
            type="button"
            className={cx(btnDanger, compact)}
            disabled={busy}
            onClick={() => onReview(remission, 'Rechazada')}
          >
            <X size={15} /> Rechazar
          </button>
          <button
            type="button"
            className={cx(btnSuccess, compact)}
            disabled={busy}
            onClick={() => onReview(remission, 'Validada')}
          >
            <Check size={15} /> Validar
          </button>
        </div>
      )}
    </li>
  );
}

const MAX_FILE_MB = 10;
const fileSize = (file) => `${(file.size / 1024 / 1024).toFixed(1)} MB`;

// Dos maneras de traer el archivo: la cámara del teléfono (foto de la remisión; en el teléfono
// también sirve para escanearla) o un archivo ya guardado (PDF o imagen).
function FilePicker({ file, onPick }) {
  const cameraRef = useRef(null);
  const filesRef = useRef(null);
  const pick = (event) => {
    onPick(event.target.files?.[0] ?? null);
    // Permite volver a elegir el mismo archivo después de quitarlo.
    event.target.value = '';
  };
  const tooBig = file && file.size > MAX_FILE_MB * 1024 * 1024;
  return (
    <div className="col-span-full">
      <p className="text-[11px] font-semibold">Foto, escaneo o PDF de la remisión</p>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={pick}
        aria-label="Tomar foto de la remisión"
      />
      <input
        ref={filesRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={pick}
        aria-label="Elegir archivo de la remisión"
      />
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} onClick={() => cameraRef.current?.click()}>
          <Camera size={15} /> Tomar foto o escanear
        </button>
        <button type="button" className={btnSecondary} onClick={() => filesRef.current?.click()}>
          <FolderOpen size={15} /> Elegir de mis archivos
        </button>
      </div>
      <p
        className={cx('mt-2 text-[11px] leading-[1.7]', tooBig ? 'text-gab-bad' : 'text-gab-muted')}
        role="status"
        aria-live="polite"
      >
        {!file && `Todavía no hay archivo. PDF, JPG, PNG o WebP de máximo ${MAX_FILE_MB} MB.`}
        {file && !tooBig && (
          <>
            Listo: <b className="break-all text-gab-ink">{file.name}</b> ({fileSize(file)}){' '}
            <button
              type="button"
              className="cursor-pointer text-gab-accent underline underline-offset-2"
              onClick={() => onPick(null)}
            >
              Quitar
            </button>
          </>
        )}
        {tooBig &&
          `Ese archivo pesa ${fileSize(file)}; el máximo es ${MAX_FILE_MB} MB. Elige otro.`}
      </p>
    </div>
  );
}

// Para subir la remisión basta tomarle foto o elegir el archivo.
function UploadForm({ busy, onUpload }) {
  const [file, setFile] = useState(null);
  const ready = file && file.size <= MAX_FILE_MB * 1024 * 1024;

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    if (await onUpload({ file })) setFile(null);
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 grid gap-3 rounded-[7px] border border-gab-line bg-gab-bg p-3.5"
    >
      <FilePicker file={file} onPick={setFile} />
      <div className="flex justify-end">
        <button
          type="submit"
          className={cx(btnPrimary, 'max-sm:w-full')}
          disabled={busy || !ready}
          aria-busy={busy}
        >
          <BusyIcon busy={busy} icon={Upload} />
          {busy ? 'Subiendo…' : 'Subir remisión'}
        </button>
      </div>
    </form>
  );
}

// Remisiones de la solicitud: quien registra las sube, el aprobador las valida o rechaza.
export default function RemissionsPanel({
  remissions,
  permissions,
  busy,
  onUpload,
  onReview,
  onOpenFile,
}) {
  const canUpload = permissions.canUploadRemission && onUpload;
  return (
    <section className={sectionClass} aria-labelledby="remissions-title">
      <h3
        id="remissions-title"
        className="flex items-center gap-2 font-title text-[13px] font-semibold text-gab-accent"
      >
        <FileText size={16} aria-hidden="true" />
        Remisiones
      </h3>
      {remissions.length > 0 ? (
        <ul className="mt-1 list-none p-0">
          {remissions.map((remission) => (
            <RemissionRow
              key={remission.id}
              remission={remission}
              canReview={permissions.canReviewRemission && Boolean(onReview)}
              busy={busy}
              onReview={onReview}
              onOpenFile={onOpenFile}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-gab-muted">
          Todavía no hay remisiones. Sin remisión validada no se crea la OCM.
        </p>
      )}
      {canUpload && <UploadForm busy={busy} onUpload={onUpload} />}
    </section>
  );
}
