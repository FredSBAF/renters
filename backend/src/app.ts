import express, { Express } from 'express';
import { successResponse } from './utils/response';

const app: Express = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes will be added here
app.get('/', (req, res) => {
  return successResponse(res, null, 'Pouraccord API');
});

export default app;
