import { Op } from 'sequelize';
import { Agency, AuditLog, Document, Folder, NotificationPreference, SharingView, User } from '../models';
import { sendWeeklyDigest } from './EmailService';
import { logger } from '../utils/logger';

export class WeeklyDigestService {
  static async sendDigestForUser(userId: number): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user) return;
    const prefs = await NotificationPreference.findOne({ where: { user_id: userId } });
    if (!prefs || !prefs.weekly_digest_enabled) return;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (user.role === 'tenant') {
      const folder = await Folder.findOne({ where: { user_id: user.id } });
      const sharingViewsCount = folder
        ? await SharingView.count({
            include: [{ association: 'sharingLink', where: { folder_id: folder.id } }],
            where: { viewed_at: { [Op.gte]: since } },
          })
        : 0;
      const digest = {
        folder_completion: folder?.completion_percentage ?? 0,
        documents_expiring: folder
          ? await Document.count({
              where: {
                folder_id: folder.id,
                expires_at: { [Op.between]: [new Date().toISOString().slice(0, 10), new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)] },
              },
            })
          : 0,
        sharing_views_count: sharingViewsCount,
        downloads_count: await AuditLog.count({ where: { user_id: user.id, action: 'document.downloaded.agency', created_at: { [Op.gte]: since } } }),
        agencies_that_viewed: [] as string[],
      };
      await sendWeeklyDigest(user.email, user.role, digest);
    } else {
      const agency = user.agency_id ? await Agency.findByPk(user.agency_id) : null;
      const digest = {
        new_folders_count: await AuditLog.count({ where: { agency_id: user.agency_id, action: 'folder.viewed', created_at: { [Op.gte]: since } } }),
        total_folders_count: await AuditLog.count({ where: { agency_id: user.agency_id, action: 'folder.viewed' } }),
        shortlisted_count: 0,
        subscription_status: agency?.status ?? 'unknown',
        trial_days_left: agency?.trial_ends_at
          ? Math.max(0, Math.ceil((new Date(agency.trial_ends_at).getTime() - Date.now()) / 86400000))
          : undefined,
      };
      await sendWeeklyDigest(user.email, user.role, digest);
    }

    await AuditLog.create({
      user_id: user.id,
      action: 'notification.weekly_digest_sent',
      entity_type: 'user',
      entity_id: user.id,
    });
  }

  static async runWeeklyDigest(): Promise<void> {
    const day = new Date().getDay();
    const users = await User.findAll({
      where: { status: 'active' },
      include: [{ model: NotificationPreference, as: 'notificationPreference', where: { weekly_digest_enabled: true, weekly_digest_day: day } }],
    });
    const results = await Promise.allSettled(users.map((u) => WeeklyDigestService.sendDigestForUser(u.id)));
    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - sent;
    logger.info(`Weekly digest summary sent=${sent} failed=${failed} total=${results.length}`);
  }
}
