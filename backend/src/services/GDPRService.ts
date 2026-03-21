import archiver from 'archiver';
import { Op, QueryTypes } from 'sequelize';
import { PassThrough } from 'stream';
import { randomUUID } from 'crypto';
import {
  AuditLog,
  Document,
  EmailVerificationToken,
  Folder,
  Notification,
  PasswordResetToken,
  RefreshToken,
  SharingLink,
  SharingView,
  User,
  UserConsent,
} from '../models';
import { sequelize } from '../config/database';
import { config } from '../config/env';
import { AdminUserService } from './AdminUserService';
import { NotificationService } from './NotificationService';
import { S3Service } from './S3Service';
import { logger } from '../utils/logger';

export class GDPRService {
  static async exportUserData(userId: number): Promise<Buffer> {
    const user = await User.findByPk(userId, { attributes: { exclude: ['password_hash', 'totp_secret'] } });
    if (!user) throw new Error('NOT_FOUND');
    const folder = await Folder.findOne({ where: { user_id: userId } });
    const documents = folder ? await Document.findAll({ where: { folder_id: folder.id } }) : [];
    const links = folder ? await SharingLink.findAll({ where: { folder_id: folder.id } }) : [];
    const views = links.length ? await SharingView.findAll({ where: { sharing_link_id: { [Op.in]: links.map((l) => l.id) } } }) : [];
    const consents = await UserConsent.findAll({ where: { user_id: userId } });
    const logs = await AuditLog.findAll({ where: { user_id: userId }, order: [['created_at', 'DESC']] });
    const notifications = await Notification.findAll({ where: { user_id: userId }, order: [['created_at', 'DESC']] });

    const archive = archiver('zip', { zlib: { level: 9 } });
    const passthrough = new PassThrough();
    const chunks: Buffer[] = [];
    passthrough.on('data', (c) => chunks.push(Buffer.from(c)));
    archive.pipe(passthrough);
    archive.append(
      JSON.stringify(
        {
          profil: user,
          dossier: folder,
          documents: documents.map((d) => ({ ...d.toJSON(), file_path: undefined })),
          partages: links,
          vues: views.map((v) => ({ ...v.toJSON(), agency_id: null })),
          consentements: consents,
          activite: logs,
          notifications,
        },
        null,
        2
      ),
      { name: 'mes_donnees.json' }
    );
    for (const doc of documents) {
      try {
        const b = await S3Service.getFileBuffer(doc.file_path);
        archive.append(b, { name: `documents/${doc.file_name}` });
      } catch {
        // ignore
      }
    }
    await archive.finalize();
    await new Promise((resolve) => passthrough.on('end', resolve));
    await AuditLog.create({ user_id: userId, action: 'gdpr.data_exported.self', entity_type: 'user', entity_id: userId });
    return Buffer.concat(chunks);
  }

  static async requestDeletion(userId: number): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user || user.status === 'deleted') throw new Error('NOT_ALLOWED');
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + config.gdpr.accountGraceDays * 24 * 60 * 60 * 1000);
    await user.update({
      status: 'pending_deletion' as never,
      deletion_requested_at: new Date(),
      deletion_cancellation_token: token,
      deletion_cancellation_token_expires_at: expiresAt,
    } as never);
    await RefreshToken.destroy({ where: { user_id: userId } });
    const folder = await Folder.findOne({ where: { user_id: userId } });
    if (folder) await SharingLink.update({ revoked_at: new Date() }, { where: { folder_id: folder.id, revoked_at: null } });
    await AuditLog.create({ user_id: userId, action: 'gdpr.deletion_requested', entity_type: 'user', entity_id: userId });
  }

  static async cancelDeletion(token: string): Promise<void> {
    const user = await User.findOne({
      where: {
        deletion_cancellation_token: token as never,
        deletion_cancellation_token_expires_at: { [Op.gte]: new Date() } as never,
      } as never,
    });
    if (!user) throw new Error('INVALID_TOKEN');
    await user.update({
      status: 'active' as never,
      deletion_requested_at: null,
      deletion_cancellation_token: null,
      deletion_cancellation_token_expires_at: null,
    } as never);
    await AuditLog.create({ user_id: user.id, action: 'gdpr.deletion_cancelled', entity_type: 'user', entity_id: user.id });
  }

  static async processExpiredAccounts(): Promise<void> {
    const deadline = new Date(Date.now() - config.gdpr.accountGraceDays * 24 * 60 * 60 * 1000);
    const users = await User.findAll({ where: { status: 'pending_deletion' as never, deletion_requested_at: { [Op.lt]: deadline } as never } as never });
    await Promise.allSettled(users.map((u) => AdminUserService.deleteUser(u.id, 1)));
  }

  static async cleanExpiredFolders(): Promise<void> {
    const folders = await Folder.findAll({ where: { deleted_at: null, expires_at: { [Op.lt]: new Date() }, folder_status: { [Op.ne]: 'archived' } } });
    await Promise.allSettled(
      folders.map(async (folder) => {
        const docs = await Document.findAll({ where: { folder_id: folder.id } });
        for (const d of docs) {
          try {
            await S3Service.deleteFile(d.file_path);
          } catch {
            // noop
          }
          await d.update({ deleted_at: new Date() });
        }
        await folder.update({ deleted_at: new Date() });
        await SharingLink.update({ revoked_at: new Date() }, { where: { folder_id: folder.id, revoked_at: null } });
        await NotificationService.notifyFolderExpiringSoon(folder.user_id, 0);
        await AuditLog.create({ user_id: folder.user_id, action: 'gdpr.folder_expired', entity_type: 'folder', entity_id: folder.id });
      })
    );
  }

  static async cleanExpiredFolderWarnings(): Promise<void> {
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const folders = await Folder.findAll({
      where: { deleted_at: null, expires_at: { [Op.between]: [new Date(), end] }, folder_expiry_notified_at: null as never } as never,
    });
    await Promise.allSettled(
      folders.map(async (f) => {
        const days = Math.max(0, Math.ceil((new Date(f.expires_at as Date).getTime() - Date.now()) / 86400000));
        await NotificationService.notifyFolderExpiringSoon(f.user_id, days);
        await f.update({ folder_expiry_notified_at: new Date() } as never);
      })
    );
  }

  static async anonymizeOldAuditLogs(): Promise<void> {
    const years = config.gdpr.auditLogAnonymizeYears;
    await sequelize.query(
      `UPDATE audit_logs
       SET user_id = NULL, ip_address = '0.0.0.0'
       WHERE created_at < DATE_SUB(NOW(), INTERVAL :years YEAR) AND user_id IS NOT NULL`,
      { replacements: { years }, type: QueryTypes.UPDATE }
    );
  }

  static async cleanRevokedTokens(): Promise<void> {
    const now = new Date();
    const [rt, evt, prt] = await Promise.all([
      RefreshToken.destroy({ where: { expires_at: { [Op.lt]: now } } }),
      EmailVerificationToken.destroy({ where: { expires_at: { [Op.lt]: now } } }),
      PasswordResetToken.destroy({ where: { expires_at: { [Op.lt]: now } } }),
    ]);
    logger.info(`Token cleanup deleted refresh=${rt} verify=${evt} reset=${prt}`);
  }
}
