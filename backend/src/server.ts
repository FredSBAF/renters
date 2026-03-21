import { config } from './config/env';
import app from './app';
import { logger } from './utils/logger';
import './jobs/trialReminder.job';
import './jobs/documentExpiry.job';
import './jobs/moderationSLA.job';
import './jobs/weeklyDigest.job';
import './jobs/gdprCleanup.job';

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});
