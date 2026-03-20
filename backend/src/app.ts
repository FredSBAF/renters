import express, { Express } from 'express';
import { successResponse } from './utils/response';
import { logger } from './utils/logger';
import routes from './routes';
import './models'; // load associations

const app: Express = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/', routes);

export default app;
