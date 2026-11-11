import { attachmentService } from '../services/attachment.service.js';

export const attachmentController = {
  async upload(req, res) {
    res.status(201).json(await attachmentService.upload(req.params.id, req.file, req.session.user));
  },
  async download(req, res) {
    const file = await attachmentService.download(req.params.id, req.session.user);
    res.set('Cache-Control', 'no-store');
    res.download(file.path, file.name);
  },
};
