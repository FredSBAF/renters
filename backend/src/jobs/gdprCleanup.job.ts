import cron from 'node-cron';
import { GDPRService } from '../services/GDPRService';
import { logger } from '../utils/logger';

cron.schedule('0 2 * * *', async () => {
  const results = await Promise.allSettled([
    GDPRService.cleanExpiredFolderWarnings(),
    GDPRService.cleanExpiredFolders(),
    GDPRService.processExpiredAccounts(),
    GDPRService.cleanRevokedTokens(),
  ]);
  logger.info(`GDPR daily cleanup done count=${results.length}`);
});

cron.schedule('0 3 1 1 *', async () => {
  await GDPRService.anonymizeOldAuditLogs();
  logger.info('GDPR yearly anonymization done');
});
