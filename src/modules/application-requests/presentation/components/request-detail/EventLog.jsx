import { History } from 'lucide-react';
import { sectionClass } from './DetailSection.jsx';

const moment = (value) =>
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );

// Historial de la solicitud: todo lo que le ha pasado, quién lo hizo y cuándo (lo más nuevo arriba).
export default function EventLog({ events }) {
  const newestFirst = [...events].reverse();
  return (
    <section className={sectionClass} aria-labelledby="event-log-title">
      <h3
        id="event-log-title"
        className="flex items-center gap-2 font-title text-[13px] font-semibold text-gab-accent"
      >
        <History size={16} aria-hidden="true" />
        Historial
      </h3>
      <ol className="mt-3 list-none border-l border-gab-line p-0 pl-4">
        {newestFirst.map((event, index) => (
          <li key={`${event.created_at}-${index}`} className="relative pb-3 last:pb-0">
            <i className="absolute top-[5px] -left-[20.5px] size-2 rounded-full bg-gab-accent" />
            <p className="text-[13px] font-medium break-words">{event.description}</p>
            <p className="mt-0.5 text-[11px] text-gab-muted">
              {event.actor} · {moment(event.created_at)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
