import { useEffect, useState } from 'react';
import { ImageDown } from 'lucide-react';
import { cx, textAction } from '../../../../../shared/ui/classes.js';

// Imagen de la receta a la vista (foto o captura que subió quien capturó), con opción de bajarla.
export default function RecipeImage({ file, onLoad, onDownload }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!onLoad) return undefined;
    let current = true;
    let created = '';
    onLoad(file)
      .then(({ blob }) => {
        if (!current) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [file.id, onLoad]);

  return (
    <figure className="mt-2">
      {url && (
        <img
          src={url}
          alt="Imagen de la receta"
          className="max-h-[420px] w-full rounded-md border border-gab-line bg-gab-bg object-contain"
        />
      )}
      {!url && !failed && onLoad && (
        <p className="text-xs text-gab-muted">Cargando la imagen de la receta…</p>
      )}
      {failed && <p className="text-xs text-gab-bad">No se pudo mostrar la imagen de la receta.</p>}
      <figcaption>
        <button type="button" className={cx(textAction, 'mt-2')} onClick={() => onDownload?.(file)}>
          <ImageDown size={14} /> Descargar imagen
        </button>
      </figcaption>
    </figure>
  );
}
