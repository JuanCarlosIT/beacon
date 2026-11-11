// /validar = vista de quien valida (lista y detalle); cualquier otra ruta = captura.
export const viewFromPath = (pathname) =>
  /^\/validar\/?$/.test(String(pathname)) ? 'review' : 'capture';
