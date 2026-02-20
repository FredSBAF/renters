import express, { Express } from 'express';
import { successResponse } from './utils/response';
import { logger } from './utils/logger';

const app: Express = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes will be added here
app.get('/', (req, res) => {
  return successResponse(res, null, 'Pouraccord API');
});

/**
 * GET /health — Health check for load balancers and monitoring.
 * Returns status, timestamp and process uptime. Logged via Winston.
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

export default app;
