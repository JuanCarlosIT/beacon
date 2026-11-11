import { cx, statusBadge } from '../../../../shared/ui/classes.js';

export default function StatusBadge({ status }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[10px] font-semibold whitespace-nowrap',
        statusBadge[status] || 'bg-gab-gris-bg text-gab-muted',
      )}
    >
      <i className="size-[5px] rounded-full bg-current" />
      {status}
    </span>
  );
}
