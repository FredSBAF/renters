import express, { Express } from 'express';
import { successResponse } from './utils/response';
import { logger } from './utils/logger';
import routes from './routes';
import usersRouter from './routes/users.routes';
import openApiRouter from './routes/openapi.routes';
import webhookRouter from './routes/webhook.routes';
import billingRouter from './routes/billing.routes';
import { corsMiddleware } from './middlewares/cors.middleware';
import { autoAuditLog } from './middlewares/auditLog.middleware';
import { preventNoSQLInjection, preventXSS, validateContentType } from './middlewares/inputValidation.middleware';
import { requestId, sanitizeInput, suspendedAccountCheck } from './middlewares/security.middleware';
import './models'; // load associations

const app: Express = express();

app.use(corsMiddleware);

/** OpenAPI spec + Swagger UI (/api/openapi.yaml, /api/docs/) */
app.use('/api', openApiRouter);

app.use(
  '/api/v1/webhooks',
  express.raw({ type: 'application/json' }),
  webhookRouter
);

// Basic middleware
app.use(requestId);
app.use(sanitizeInput);
app.use(preventNoSQLInjection);
app.use(preventXSS);
app.use(validateContentType);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(autoAuditLog);

app.get('/', (req, res) => {
  return successResponse(res, null, 'Pouraccord API');
});

/**
 * GET /health — Health check for load balancers and monitoring.
 */
app.get('/health', (req, res) => {
  logger.debug('GET /health');
  const data = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
  return successResponse(res, data, 'Health check');
});

app.use('/api/v1', routes);
app.use('/v1/users', usersRouter);
app.use('/api/v1', suspendedAccountCheck);
app.use('/api/v1/billing', billingRouter);
app.use('/', routes);

export default app;
