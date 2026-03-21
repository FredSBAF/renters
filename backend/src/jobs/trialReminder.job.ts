import cron from 'node-cron';
import { Op } from 'sequelize';
import { Agency, User } from '../models';
import { NotificationService } from '../services/NotificationService';
import { logger } from '../utils/logger';

cron.schedule('0 9 * * *', async () => {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const agencies = await Agency.findAll({
    where: {
      status: 'trial',
      trial_ends_at: {
        [Op.between]: [now, inSevenDays],
      },
    },
  });

  let sentCount = 0;
  for (const agency of agencies) {
    if (!agency.trial_ends_at) continue;

    const owner = await User.findOne({
      where: { agency_id: agency.id, role: 'agency_owner' },
    });
    if (!owner) continue;

    const daysLeft = Math.ceil(
      (new Date(agency.trial_ends_at).getTime() - now.getTime()) / 86400000
    );
    await NotificationService.notifyTrialEnding(owner.id, daysLeft);
    sentCount += 1;
    logger.info(`Trial reminder sent for agency=${agency.id} owner=${owner.email}`);
  }

  logger.info(`Trial reminder job completed. Emails sent: ${sentCount}`);
});
