import { catalogService } from '../services/catalog.service.js';

export async function listCatalogs(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await catalogService.list({ refresh: req.query.refresh === '1' }, req.session.user));
}
