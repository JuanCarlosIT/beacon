import multer from 'multer';
import { z } from 'zod';
import { HttpError } from '../errors/HttpError.js';
import { CatalogError } from '../models/catalog.model.js';

const catalogResponse = (error) => {
  const unavailable = error.status >= 500;
  if (unavailable) console.warn('Catálogos Odoo:', error.message);
  return {
    status: error.status,
    message: unavailable ? 'No pudimos cargar las opciones. Intenta de nuevo.' : error.message,
  };
};

const zodMessage = (error) =>
  error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ');

// Errores conocidos → { status, message }. El primero que reconoce el error responde.
const KNOWN_ERRORS = [
  [CatalogError, catalogResponse],
  [HttpError, (error) => ({ status: error.status, message: error.message })],
  [z.ZodError, (error) => ({ status: 400, message: zodMessage(error) })],
  [multer.MulterError, () => ({ status: 400, message: 'Adjunta un archivo de máximo 10 MB.' })],
];

const unexpected = (error) => {
  console.error('Error de aplicación:', error.code || error.name);
  return { status: 500, message: 'No pudimos completar la acción. Intenta de nuevo.' };
};

const describeError = (error) => {
  const known = KNOWN_ERRORS.find(([type]) => error instanceof type);
  return known ? known[1](error) : unexpected(error);
};

export function notFound(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada.' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const { status, message } = describeError(error);
  res.status(status).json({ error: message });
}
