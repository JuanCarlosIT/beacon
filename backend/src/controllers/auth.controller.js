import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { demoUsers } from '../models/demoUsers.js';

const demoPassword = bcrypt.hashSync('DemoLocal2026!', 10);
const loginSchema = z.object({ email: z.string().max(200), password: z.string().max(200) });
export const authController = {
  me(req, res) {
    res.json({ user: req.session.user || null });
  },
  async login(req, res) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Indica usuario y contraseña.' });
    const user = demoUsers.find((user) => user.email === parsed.data.email.toLowerCase().trim());
    if (!user || !(await bcrypt.compare(parsed.data.password, demoPassword)))
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    req.session.regenerate((error) => {
      if (error) return res.status(500).json({ error: 'No se pudo iniciar la sesión.' });
      req.session.user = user;
      res.json({ user });
    });
  },
  logout(req, res) {
    req.session.destroy(() => {
      res.clearCookie('gab.sid');
      res.json({ ok: true });
    });
  },
};
