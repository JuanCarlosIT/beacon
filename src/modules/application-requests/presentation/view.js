// Dos vistas: /validar es la del gestor (sube remisiones y arma la OCM); cualquier otra ruta
// es la de quien captura y autoriza las solicitudes.
export const viewFromPath = (pathname) =>
  /^\/validar\/?$/.test(String(pathname)) ? 'review' : 'capture';
