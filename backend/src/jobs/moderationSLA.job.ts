import cron from 'node-cron';
import { ModerationService } from '../services/ModerationService';
import { logger } from '../utils/logger';

cron.schedule('0 */4 * * *', async () => {
  await ModerationService.checkSLABreaches();
  logger.info('Moderation SLA check completed');
});
