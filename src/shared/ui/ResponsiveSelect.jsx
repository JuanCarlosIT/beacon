import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './classes.js';
import SelectMenu from './select/SelectMenu.jsx';
import { useFloatingMenu } from './select/useFloatingMenu.js';
import { OPEN_KEYS, filterOptions, sameValue } from './select/selectMenu.js';

const triggerClass = cx(
  'flex min-h-11 w-full min-w-0 cursor-pointer items-center justify-between gap-2.5 rounded-md border border-gab-line',
  'bg-gab-surface px-3 py-2.5 text-left text-[13px] text-gab-ink [&>svg]:shrink-0 [&>svg]:text-gab-muted',
  'disabled:cursor-not-allowed disabled:bg-gab-gris-bg disabled:text-gab-muted',
  'aria-expanded:border-gab-accent aria-expanded:outline-2 aria-expanded:outline-gab-accent-soft',
  'aria-invalid:border-gab-bad aria-invalid:bg-[color-mix(in_srgb,var(--gab-bad-bg)_30%,var(--gab-surface))]',
  'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gab-accent max-sm:text-base',
);

// Lista propia: el popup nativo de <select> puede exceder el viewport en Windows.
export default function ResponsiveSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  searchLabel = name,
  disabled = false,
  ...aria
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const keyboardOpen = useRef(false);
  const selected = options.find((option) => sameValue(option.value, value));
  const { matches, visible } = filterOptions(options, query);

  function close(restoreFocus = false) {
    setOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }
  const { position, themeStyle } = useFloatingMenu({
    open,
    triggerRef,
    menuRef,
    optionCount: visible.length,
    close,
  });

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  // Si se abrió con teclado, el foco pasa a la búsqueda en cuanto el menú tiene posición.
  useEffect(() => {
    if (!open || !position || !keyboardOpen.current) return;
    searchRef.current?.focus({ preventScroll: true });
    keyboardOpen.current = false;
  }, [open, position]);

  function choose(option) {
    onChange(String(option.value));
    close(true);
  }
  function toggle() {
    if (open) return close();
    setQuery('');
    setOpen(true);
  }
  function openWithKeyboard(event) {
    if (open || !OPEN_KEYS.includes(event.key)) return;
    event.preventDefault();
    keyboardOpen.current = true;
    setOpen(true);
  }

  return (
    <>
      <button
        {...aria}
        id={id}
        name={name}
        type="button"
        ref={triggerRef}
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        disabled={disabled}
        className={triggerClass}
        data-value={value}
        onClick={toggle}
        onKeyDown={openWithKeyboard}
      >
        <span className={cx('block min-w-0 truncate', !selected && 'text-gab-muted')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && position && (
        <SelectMenu
          id={id}
          value={value}
          query={query}
          onQuery={setQuery}
          searchLabel={searchLabel}
          visible={visible}
          totalMatches={matches.length}
          onChoose={choose}
          menuRef={menuRef}
          searchRef={searchRef}
          position={position}
          themeStyle={themeStyle}
        />
      )}
    </>
  );
}
