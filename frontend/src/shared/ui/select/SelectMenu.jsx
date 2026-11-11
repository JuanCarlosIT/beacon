import { createPortal } from 'react-dom';
import { Check, Search } from 'lucide-react';
import { cx } from '../classes.js';
import { CHOOSE_KEYS, nextOptionIndex, sameValue } from './selectMenu.js';

const optionClass = cx(
  'flex min-h-11 cursor-pointer items-center justify-between gap-[9px] rounded-[5px] px-2.5 py-[11px]',
  'text-[13px] leading-[1.6] text-gab-ink [&>span]:min-w-0 [&>span]:break-words [&>svg]:shrink-0 max-sm:text-sm',
  'hover:bg-gab-accent-soft hover:text-gab-accent focus-visible:bg-gab-accent-soft focus-visible:text-gab-accent',
  'focus-visible:outline-none aria-selected:bg-gab-accent-soft aria-selected:text-gab-accent',
);
const noteClass = 'px-3 py-5 text-[13px] text-gab-muted';

const optionsOf = (menu) => menu?.querySelectorAll('[role="option"]') ?? [];

// Menú flotante del selector (va en un portal para no quedar recortado).
export default function SelectMenu({
  id,
  value,
  query,
  onQuery,
  searchLabel,
  visible,
  totalMatches,
  onChoose,
  menuRef,
  searchRef,
  position,
  themeStyle,
}) {
  function searchKeys(event) {
    if (event.key !== 'ArrowDown' || !visible.length) return;
    event.preventDefault();
    optionsOf(menuRef.current)[0]?.focus();
  }
  function optionKeys(event, index) {
    if (CHOOSE_KEYS.includes(event.key)) {
      event.preventDefault();
      onChoose(visible[index]);
      return;
    }
    const next = nextOptionIndex(event.key, index, visible.length);
    if (next === undefined) return;
    event.preventDefault();
    optionsOf(menuRef.current)[next]?.focus();
  }

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[1000] font-sans text-gab-ink"
      style={themeStyle}
    >
      <div
        className="pointer-events-auto fixed flex min-w-0 flex-col overflow-hidden rounded-[9px] border border-gab-line bg-gab-surface shadow-[0_8px_30px_#12181d26]"
        ref={menuRef}
        style={position}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-gab-line px-3 py-[11px] text-gab-muted [&>svg]:shrink-0">
          <Search size={16} />
          <input
            ref={searchRef}
            className="min-h-[26px] w-full min-w-0 border-0 bg-transparent text-base text-gab-ink outline-none"
            type="search"
            placeholder="Buscar en la lista…"
            aria-label={`Buscar ${searchLabel}`}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={searchKeys}
          />
        </div>
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="m-0 list-none overflow-x-hidden overflow-y-auto overscroll-contain p-1 [scrollbar-gutter:stable]"
        >
          {visible.map((option, index) => {
            const isSelected = sameValue(option.value, value);
            return (
              <li
                key={option.value}
                id={`${id}-option-${option.value}`}
                role="option"
                aria-selected={isSelected}
                data-value={option.value}
                tabIndex={0}
                className={optionClass}
                onClick={() => onChoose(option)}
                onKeyDown={(event) => optionKeys(event, index)}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={16} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
        {!visible.length && <p className={noteClass}>No hay coincidencias.</p>}
        {totalMatches > visible.length && (
          <p className={noteClass} role="status">
            Mostrando {visible.length} de {totalMatches}. Escribe para filtrar.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
