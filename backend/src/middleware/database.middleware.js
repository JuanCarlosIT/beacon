import { ensureDatabase } from '../config/database.js';

export async function requireDatabase(req, res, next) {
  try {
    await ensureDatabase();
    next();
  } catch (error) {
    console.warn('PostgreSQL no disponible:', error.code || error.name);
    res.status(503).json({ error: 'Servicio no disponible. Intenta de nuevo.' });
  }
}
