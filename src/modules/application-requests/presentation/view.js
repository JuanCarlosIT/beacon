// Dos vistas: /validar es la del gestor (sube remisiones y arma la OCM); cualquier otra ruta
// es la de quien captura y autoriza las solicitudes.
// Con usuario de la app principal manda su perfil: el gestor ve la vista de remisiones y OCM.
export const viewFromRole = (role) => (role === 'gestor' ? 'review' : 'capture');

export const viewFromPath = (pathname) =>
  /^\/validar\/?$/.test(String(pathname)) ? 'review' : 'capture';
