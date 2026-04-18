import express, { Express, Request, Response, NextFunction } from 'express';
import listEndpoints from 'express-list-endpoints';
import { successResponse } from './utils/response';
import { logger } from './utils/logger';
import routes from './routes';
import openApiRouter from './routes/openapi.routes';
import webhookRouter from './routes/webhook.routes';
import billingRouter from './routes/billing.routes';
import { corsMiddleware } from './middlewares/cors.middleware';
import { autoAuditLog } from './middlewares/auditLog.middleware';
import { preventNoSQLInjection, preventXSS, validateContentType } from './middlewares/inputValidation.middleware';
import { requestId, sanitizeInput, suspendedAccountCheck } from './middlewares/security.middleware';
import { requireAuth } from './middlewares/auth.middleware';
import './models'; // load associations

const app: Express = express();

app.use(corsMiddleware);

const publicApiRoutePatterns: Array<{ path: RegExp; methods?: string[] }> = [
  { path: /^\/api\/v1\/auth\/(register|verify-email|login|refresh|logout|forgot-password|reset-password)$/ },
  { path: /^\/api\/v1\/agencies\/(register|join)$/ },
  { path: /^\/api\/v1\/webhooks\/stripe$/ },
  { path: /^\/api\/v1\/guarantors\/accept$/ },
  { path: /^\/api\/v1\/sharing\/view\/[^/]+$/ },
];

function isPublicApiRoute(req: Request): boolean {
  const fullPath = `${req.baseUrl}${req.path}`;
  return publicApiRoutePatterns.some((route) => {
    if (!route.path.test(fullPath)) return false;
    return !route.methods || route.methods.includes(req.method);
  });
}

async function apiAuthGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (isPublicApiRoute(req)) {
    next();
    return;
  }
  await requireAuth(req, res, next);
}

const enableOpenApiDocs = process.env.NODE_ENV !== 'production';
if (enableOpenApiDocs) {
  /** OpenAPI spec + Swagger UI (/api/openapi.yaml, /api/docs/) */
  app.use('/api', openApiRouter);
}

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

// Canonical API prefix. All application routes should be mounted on /api/v1.
app.use('/api/v1', apiAuthGuard);
app.use('/api/v1', suspendedAccountCheck);
app.use('/api/v1', routes);
app.use('/api/v1/billing', billingRouter);

const registeredEndpoints = listEndpoints(app);
logger.info(`Registered ${registeredEndpoints.length} routes:`);
registeredEndpoints.forEach((route: { methods: string[]; path: string }) => {
  logger.info(`${route.methods.join(', ')} ${route.path}`);
});

export default app;
