import { Op } from 'sequelize';
import {
  Agency,
  AuditLog,
  Folder,
  Notification,
  NotificationPreference,
  SharingLink,
  User,
} from '../models';
import {
  sendDocumentDownloaded,
  sendDocumentExpired,
  sendDocumentExpiringSoon,
  sendFolderExpiringSoon,
  sendFolderViewed,
  sendNewFolderShared,
  sendPaymentFailed,
  sendSubscriptionConfirmation,
  sendTrialEnding,
} from './EmailService';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export class NotificationService {
  static async getOrCreatePreferences(userId: number): Promise<NotificationPreference> {
    if (!NotificationPreference) {
      return {
        user_id: userId,
        email_enabled: true,
        inapp_enabled: true,
        email_document_expiring: true,
        email_document_expired: true,
        email_folder_complete: true,
        email_folder_verified: true,
        email_folder_viewed: false,
        email_folder_document_downloaded: false,
        email_new_folder_shared: true,
        email_subscription_alerts: true,
        weekly_digest_enabled: true,
        weekly_digest_day: 1,
      } as NotificationPreference;
    }
    const model = NotificationPreference as unknown as {
      findOrCreate?: (args: object) => Promise<[NotificationPreference, boolean]>;
    };
    if (!model.findOrCreate) {
      return {
        user_id: userId,
        email_enabled: true,
        inapp_enabled: true,
        email_document_expiring: true,
        email_document_expired: true,
        email_folder_complete: true,
        email_folder_verified: true,
        email_folder_viewed: false,
        email_folder_document_downloaded: false,
        email_new_folder_shared: true,
        email_subscription_alerts: true,
        weekly_digest_enabled: true,
        weekly_digest_day: 1,
      } as NotificationPreference;
    }
    const [preferences] = await model.findOrCreate({ where: { user_id: userId } });
    return preferences;
  }

  private static isEmailEnabled(preferences: NotificationPreference, type: string): boolean {
    const map: Record<string, keyof NotificationPreference> = {
      'document.expiring_soon': 'email_document_expiring',
      'document.expired': 'email_document_expired',
      'folder.complete': 'email_folder_complete',
      'folder.verified': 'email_folder_verified',
      'folder.viewed': 'email_folder_viewed',
      'folder.document_downloaded': 'email_folder_document_downloaded',
      'folder.new_shared': 'email_new_folder_shared',
      'subscription.trial_ending': 'email_subscription_alerts',
      'subscription.payment_failed': 'email_subscription_alerts',
      'subscription.activated': 'email_subscription_alerts',
    };
    const key = map[type];
    if (!key) return preferences.email_enabled;
    return Boolean(preferences[key] as unknown);
  }

  static async send(params: {
    userId: number;
    type: string;
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: object;
    sendEmail?: boolean;
  }): Promise<Notification | null> {
    try {
      const preferences = await NotificationService.getOrCreatePreferences(params.userId);
      let notification: Notification | null = null;
      if (preferences.inapp_enabled) {
        notification = await Notification.create({
          user_id: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          action_url: params.actionUrl ?? null,
          metadata: params.metadata ?? null,
        });
      }

      const user = await User.findByPk(params.userId);
      if (user && (params.sendEmail ?? true) && preferences.email_enabled && NotificationService.isEmailEnabled(preferences, params.type)) {
        await NotificationService.sendTypeEmail(user.email, params.type, params.metadata ?? {});
        if (notification) {
          await notification.update({ email_sent: true, email_sent_at: new Date() });
        }
      }

      await AuditLog.create({
        user_id: params.userId,
        action: 'notification.sent',
        entity_type: 'notification',
        entity_id: notification?.id ?? null,
        details: { type: params.type, user_id: params.userId } as unknown as object,
      });

      if (notification) {
        const count = await Notification.count({ where: { user_id: params.userId } });
        if (count > 100) {
          const extras = await Notification.findAll({
            where: { user_id: params.userId },
            order: [['created_at', 'DESC']],
            offset: 100,
          });
          await Notification.destroy({ where: { id: { [Op.in]: extras.map((e) => e.id) } } });
        }
      }

      return notification;
    } catch (err) {
      if (config.env !== 'test') {
        logger.error('NotificationService.send failed', err);
      }
      return null;
    }
  }

  private static async sendTypeEmail(email: string, type: string, metadata: object): Promise<void> {
    const data = metadata as Record<string, unknown>;
    switch (type) {
      case 'document.expiring_soon':
        await sendDocumentExpiringSoon(email, String(data.document_type ?? 'document'), Number(data.days_left ?? 7));
        break;
      case 'document.expired':
        await sendDocumentExpired(email, String(data.document_type ?? 'document'));
        break;
      case 'folder.viewed':
        await sendFolderViewed(email, String(data.agency_name ?? 'Une agence'), new Date());
        break;
      case 'folder.document_downloaded':
        await sendDocumentDownloaded(email, String(data.agency_name ?? 'Une agence'), (data.document_types as string[]) ?? []);
        break;
      case 'folder.new_shared':
        await sendNewFolderShared(email, String(data.tenant_name ?? 'Un locataire'), Number(data.score ?? 0), String(data.folder_url ?? '/dossiers'));
        break;
      case 'folder.expiring_soon':
        await sendFolderExpiringSoon(email, Number(data.days_left ?? 30));
        break;
      case 'subscription.trial_ending':
        await sendTrialEnding(email, Number(data.days_left ?? 7));
        break;
      case 'subscription.payment_failed':
        await sendPaymentFailed(email, Number(data.attempt_count ?? 1));
        break;
      case 'subscription.activated':
        await sendSubscriptionConfirmation(email);
        break;
      default:
        break;
    }
  }

  static async getNotifications(
    userId: number,
    params: { page: number; limit: number; unread_only?: boolean }
  ): Promise<{ notifications: Notification[]; total: number; unread_count: number }> {
    const where: Record<string, unknown> = { user_id: userId };
    if (params.unread_only) where.is_read = false;
    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      offset: (params.page - 1) * params.limit,
      limit: params.limit,
    });
    const unread_count = await Notification.count({ where: { user_id: userId, is_read: false } });
    return { notifications: rows, total: count, unread_count };
  }

  static async markAsRead(notificationId: number, userId: number): Promise<void> {
    const notification = await Notification.findByPk(notificationId);
    if (!notification || notification.user_id !== userId) throw new Error('FORBIDDEN');
    await notification.update({ is_read: true, read_at: new Date() });
  }

  static async markAllAsRead(userId: number): Promise<void> {
    await Notification.update({ is_read: true, read_at: new Date() }, { where: { user_id: userId, is_read: false } });
  }

  static async deleteNotification(notificationId: number, userId: number): Promise<void> {
    const notification = await Notification.findByPk(notificationId);
    if (!notification || notification.user_id !== userId) throw new Error('FORBIDDEN');
    await Notification.destroy({ where: { id: notificationId } });
  }

  static async getUnreadCount(userId: number): Promise<number> {
    return Notification.count({ where: { user_id: userId, is_read: false } });
  }

  static async updatePreferences(
    userId: number,
    updates: Partial<NotificationPreference>
  ): Promise<NotificationPreference> {
    const preferences = await NotificationService.getOrCreatePreferences(userId);
    await preferences.update(updates);
    return preferences;
  }

  static async notifyDocumentExpiringSoon(userId: number, documentType: string, daysLeft: number): Promise<Notification | null> {
    return NotificationService.send({
      userId,
      type: 'document.expiring_soon',
      title: 'Document expire bientot',
      message: `Votre ${documentType} expire dans ${daysLeft} jours.`,
      actionUrl: '/dashboard',
      metadata: { document_type: documentType, days_left: daysLeft },
    });
  }
  static async notifyDocumentExpired(userId: number, documentType: string): Promise<Notification | null> {
    return NotificationService.send({
      userId,
      type: 'document.expired',
      title: 'Document expire',
      message: `Votre ${documentType} a expire et a ete supprime.`,
      actionUrl: '/dashboard',
      metadata: { document_type: documentType },
    });
  }
  static async notifyFolderComplete(userId: number): Promise<void> {
    await NotificationService.send({
      userId,
      type: 'folder.complete',
      title: 'Dossier complet !',
      message: 'Votre dossier est complet. Vous pouvez le partager.',
      actionUrl: '/dashboard',
    });
  }
  static async notifyFolderVerified(userId: number, score: number): Promise<void> {
    await NotificationService.send({
      userId,
      type: 'folder.verified',
      title: 'Dossier verifie',
      message: 'Votre dossier a ete verifie avec succes.',
      actionUrl: '/dashboard',
      metadata: { score },
    });
  }
  static async notifyFolderViewed(userId: number, agencyName: string, linkId: string): Promise<void> {
    await NotificationService.send({
      userId,
      type: 'folder.viewed',
      title: 'Dossier consulte',
      message: `${agencyName} a consulte votre dossier.`,
      actionUrl: '/shares/history',
      metadata: { agency_name: agencyName, link_id: linkId },
    });
  }
  static async notifyDocumentDownloaded(userId: number, agencyName: string, documentTypes: string[]): Promise<void> {
    await NotificationService.send({
      userId,
      type: 'folder.document_downloaded',
      title: 'Documents telecharges',
      message: `${agencyName} a telecharge ${documentTypes.length} document(s).`,
      actionUrl: '/shares/history',
      metadata: { agency_name: agencyName, document_types: documentTypes, count: documentTypes.length },
    });
  }
  static async notifyNewFolderShared(agencyOwnerId: number, tenantName: string, folderId: number, score?: number): Promise<void> {
    const owner = await User.findByPk(agencyOwnerId);
    if (!owner?.agency_id) return;
    const agents = await User.findAll({ where: { agency_id: owner.agency_id, role: { [Op.in]: ['agency_owner', 'agency_agent'] } } });
    await Promise.all(
      agents.map((u) =>
        NotificationService.send({
          userId: u.id,
          type: 'folder.new_shared',
          title: 'Nouveau dossier recu',
          message: `${tenantName} a partage son dossier avec votre agence.`,
          actionUrl: `/dossiers/${folderId}`,
          metadata: { tenant_name: tenantName, folder_id: folderId, score, folder_url: `/dossiers/${folderId}` },
        })
      )
    );
  }
  static async notifyFolderExpiringSoon(userId: number, daysLeft: number): Promise<void> {
    await NotificationService.send({
      userId,
      type: 'folder.expiring_soon',
      title: 'Dossier expire bientot',
      message: `Votre dossier expire dans ${daysLeft} jours.`,
      actionUrl: '/dashboard',
      metadata: { days_left: daysLeft },
    });
  }
  static async notifyTrialEnding(userId: number, daysLeft: number): Promise<void> {
    await NotificationService.send({
      userId,
      type: 'subscription.trial_ending',
      title: 'Essai gratuit bientot termine',
      message: `Votre essai gratuit se termine dans ${daysLeft} jours.`,
      actionUrl: '/billing',
      metadata: { days_left: daysLeft },
    });
  }
  static async notifyPaymentFailed(userId: number, attemptCount: number): Promise<void> {
    await NotificationService.send({
      userId,
      type: 'subscription.payment_failed',
      title: 'Echec de paiement',
      message: `Votre paiement a echoue (${attemptCount}/3 tentatives).`,
      actionUrl: '/billing',
      metadata: { attempt_count: attemptCount },
    });
  }
  static async notifySubscriptionActivated(userId: number): Promise<void> {
    await NotificationService.send({
      userId,
      type: 'subscription.activated',
      title: 'Abonnement active',
      message: 'Votre abonnement Renters est actif. Bienvenue !',
      actionUrl: '/dossiers',
    });
  }
}
