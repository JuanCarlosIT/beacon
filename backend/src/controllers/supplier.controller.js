import { supplierService } from '../services/supplier.service.js';

export const supplierController = {
  async candidates(req, res) {
    res.set('Cache-Control', 'no-store');
    res.json(await supplierService.candidates(req.query.q, req.session.user));
  },
  async register(req, res) {
    res.status(201).json(await supplierService.register(req.body, req.session.user));
  },
};
