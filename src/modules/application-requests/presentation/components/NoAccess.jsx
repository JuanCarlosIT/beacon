import { ShieldOff } from 'lucide-react';
import { getGabThemeStyle } from '../../../../shared/theme/theme.js';
import { cx, panel } from '../../../../shared/ui/classes.js';
import '../../../../shared/theme/fonts.js';

// El usuario de la app principal no tiene perfil en este módulo: no se muestra nada más.
export default function NoAccess({ theme = 'light' }) {
  return (
    <section
      className="mx-auto box-border flex min-h-dvh max-w-[420px] flex-col justify-center bg-gab-bg px-5 py-8 font-sans text-gab-ink"
      style={getGabThemeStyle(theme)}
      aria-labelledby="no-access-title"
    >
      <div className={cx(panel, 'p-6')} role="alert">
        <h1
          id="no-access-title"
          className="flex items-center gap-2 font-title text-lg font-semibold [&>svg]:text-gab-accent"
        >
          <ShieldOff size={20} aria-hidden="true" />
          Sin acceso a Aplicaciones aéreas
        </h1>
        <p className="mt-2 text-xs leading-[1.7] text-gab-muted">
          Tu usuario no está dado de alta en este módulo. Pide a Sistemas que te agregue si
          necesitas capturar solicitudes o subir remisiones.
        </p>
      </div>
    </section>
  );
}
