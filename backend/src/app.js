import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from './config/env.js';
import { apiRoutes } from './routes/api.routes.js';
import { implicitDemoSession } from './middleware/auth.middleware.js';
import { checkOrigin } from './middleware/security.middleware.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: config.production ? undefined : false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: 'gab.sid',
      cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000, secure: false },
    }),
  );
  app.use('/api', implicitDemoSession, checkOrigin, apiRoutes);
  if (existsSync(path.join(config.frontendDist, 'index.html'))) {
    app.use(express.static(config.frontendDist));
    app.get('/{*splat}', (req, res, next) =>
      req.path.startsWith('/api')
        ? next()
        : res.sendFile(path.join(config.frontendDist, 'index.html')),
    );
  }
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
