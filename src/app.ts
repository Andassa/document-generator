import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { correlationMiddleware } from './api/middleware/correlation.middleware';
import { metricsMiddleware } from './api/middleware/metrics.middleware';
import { errorMiddleware } from './api/middleware/error.middleware';
import { postBatch, getBatch } from './api/controllers/batch.controller';
import { getDocumentPdf } from './api/controllers/document.controller';
import { getHealth } from './api/controllers/health.controller';
import { getMetrics } from './api/controllers/metrics.controller';

export function createApp(): express.Application {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(correlationMiddleware);
  app.use(metricsMiddleware);

  const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
      req.path === '/health' ||
      req.path === '/metrics' ||
      req.path === '/openapi.yaml' ||
      req.path.startsWith('/api-docs'),
    handler: (req, res) => {
      req.logger?.warn('Limite de débit atteinte');
      res.status(429).json({
        error: { message: 'Trop de requêtes', code: 'RATE_LIMIT' },
      });
    },
  });
  app.use(limiter);

  app.get('/health', getHealth);
  app.get('/metrics', getMetrics);

  const openapiPath = path.join(__dirname, '../docs/openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    const raw = fs.readFileSync(openapiPath, 'utf8');
    const spec = yaml.load(raw) as object;
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
    app.get('/openapi.yaml', (_req, res) => {
      res.sendFile(path.resolve(openapiPath));
    });
  }

  app.post('/batch', postBatch);
  app.get('/batch/:id', getBatch);
  app.get('/:documentId', getDocumentPdf);

  app.use(errorMiddleware);
  return app;
}
