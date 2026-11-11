// Suscribe varios eventos a la vez y regresa una sola función para quitarlos (útil en useEffect).
// Cada suscripción es [target, tipo, handler, opciones?].
export function listenAll(subscriptions) {
  subscriptions.forEach(([target, type, handler, options]) =>
    target?.addEventListener(type, handler, options),
  );
  return () =>
    subscriptions.forEach(([target, type, handler, options]) =>
      target?.removeEventListener(type, handler, options),
    );
}
