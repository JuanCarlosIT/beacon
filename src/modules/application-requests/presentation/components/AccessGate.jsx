import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { getGabThemeStyle } from '../../../../shared/theme/theme.js';
import { btnPrimary, cx, input, panel } from '../../../../shared/ui/classes.js';
import '../../../../shared/theme/fonts.js';

const VIEW_NAME = {
  capture: 'Solicitud de aplicación aérea',
  review: 'Remisiones y OCM',
};

// Pantalla de entrada: pide la clave de esta vista antes de mostrar nada.
export default function AccessGate({ view, theme = 'light', onEnter, onOpen }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy || !key.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onEnter(key);
      onOpen();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <section
      className="mx-auto box-border flex min-h-dvh max-w-[420px] flex-col justify-center bg-gab-bg px-5 py-8 font-sans text-gab-ink"
      style={getGabThemeStyle(theme)}
      aria-labelledby="access-title"
    >
      <form onSubmit={submit} className={cx(panel, 'p-6')}>
        <h1
          id="access-title"
          className="flex items-center gap-2 font-title text-xl font-bold [&>svg]:text-gab-accent"
        >
          <KeyRound size={20} aria-hidden="true" />
          {VIEW_NAME[view] ?? VIEW_NAME.capture}
        </h1>
        <p className="mt-2 text-xs leading-[1.7] text-gab-muted">
          Escribe tu clave de entrada para continuar.
        </p>
        <label htmlFor="access-key" className="mt-4 block text-xs font-semibold">
          Clave
        </label>
        <input
          id="access-key"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={key}
          onChange={(event) => setKey(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'access-error' : undefined}
          className={cx(input, 'mt-1.5')}
        />
        {error && (
          <p id="access-error" role="alert" className="mt-2 text-xs text-gab-bad">
            {error}
          </p>
        )}
        <button
          type="submit"
          className={cx(btnPrimary, 'mt-4 w-full')}
          disabled={busy || !key.trim()}
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </section>
  );
}
