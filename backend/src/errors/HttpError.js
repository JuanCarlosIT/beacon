export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// Cláusula de guarda: corta con un HttpError cuando la condición no se cumple.
export function ensure(condition, status, message) {
  if (!condition) throw new HttpError(status, message);
}

// Devuelve el valor o corta con un HttpError si no existe (p. ej. 404 al buscar un registro).
export function required(value, status, message) {
  ensure(value != null, status, message);
  return value;
}
