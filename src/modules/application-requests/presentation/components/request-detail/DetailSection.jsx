export const sectionClass = 'border-b border-gab-line py-4 last:border-b-0';
const sectionTitle = 'flex items-center gap-2 font-title text-[13px] font-semibold text-gab-accent';

export default function DetailSection({ icon: Icon, title, fields, children }) {
  return (
    <section className={sectionClass}>
      <h3 className={sectionTitle}>
        <Icon size={16} aria-hidden="true" />
        {title}
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-[18px] gap-y-3">
        {fields.map(([label, value, full]) => (
          <div key={label} className={full ? 'col-span-full' : ''}>
            <dt className="text-[11px] text-gab-muted">{label}</dt>
            <dd className="mt-[3px] text-[13px] font-medium break-words whitespace-pre-line">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}
