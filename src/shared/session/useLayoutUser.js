import { useEffect, useState } from 'react';

// Clave que la app principal puede escribir en localStorage (mismo dominio) con el usuario en uso.
export const USER_STORAGE_KEY = 'gab-usuario';

const FIELDS = ['usuario', 'user', 'email', 'correo', 'login'];

// Acepta lo que mande la app principal: un texto ('luis@…') o un objeto con el usuario en
// `usuario`, `user`, `email`, `correo` o `login` (el propio `user` puede ser otro objeto).
// Devuelve el identificador en minúsculas, o null si no viene ninguno.
export function normalizeUser(value) {
  if (value && typeof value === 'object') {
    const found = FIELDS.map((field) => value[field]).find((item) => item != null && item !== '');
    return found === undefined ? null : normalizeUser(found);
  }
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  return text && text.length <= 200 ? text : null;
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    try {
      return normalizeUser(JSON.parse(raw));
    } catch {
      return normalizeUser(raw);
    }
  } catch {
    return null;
  }
}

// Escucha a la app principal para saber quién está usando el módulo. Tres vías:
// 1. La app principal lo pasa por props: <ApplicationRequests user={usuario} />.
// 2. Mensaje cuando el módulo va dentro de un iframe: postMessage({ tipo: 'usuario', usuario }).
// 3. localStorage 'gab-usuario' (si la app principal vive en el mismo dominio).
// Sin ninguna de las tres devuelve null y el módulo trabaja como app aparte (según la dirección).
// El usuario no se lee de la URL: es un dato personal y ahí quedaría en historiales.
export function useLayoutUser(fromProps) {
  const [heard, setHeard] = useState(readStored);

  useEffect(() => {
    function onMessage(event) {
      if (event.source !== window.parent || window.parent === window) return;
      const data = event.data;
      if (
        !data ||
        typeof data !== 'object' ||
        !['usuario', 'user'].includes(data.tipo ?? data.type)
      )
        return;
      setHeard(normalizeUser(data));
    }
    function onStorage(event) {
      if (event.key === USER_STORAGE_KEY) setHeard(readStored());
    }
    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return normalizeUser(fromProps) ?? heard;
}
