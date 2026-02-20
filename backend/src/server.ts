import { config } from './config/env';
import app from './app';
import { logger } from './utils/logger';

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});
