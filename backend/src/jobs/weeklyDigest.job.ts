import cron from 'node-cron';
import { WeeklyDigestService } from '../services/WeeklyDigestService';
import { logger } from '../utils/logger';

cron.schedule('0 8 * * *', async () => {
  try {
    await WeeklyDigestService.runWeeklyDigest();
  } catch (err) {
    logger.error('Weekly digest job failed', err);
  }
});
