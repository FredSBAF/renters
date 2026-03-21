import cron from 'node-cron';
import { Op } from 'sequelize';
import { Document, DocumentType, Folder, User } from '../models';
import { NotificationService } from '../services/NotificationService';
import { sendDocumentExpired, sendDocumentExpiringSoon } from '../services/EmailService';
import { S3Service } from '../services/S3Service';
import { FolderService } from '../services/FolderService';
import { logger } from '../utils/logger';

export async function runDocumentExpiryJob(): Promise<void> {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let alertsSent = 0;
  let expiredCount = 0;
  let errors = 0;

  try {
    const soonDocs = await Document.findAll({
      where: {
        status: { [Op.ne]: 'expired' },
        expires_at: { [Op.between]: [now.toISOString().slice(0, 10), inSevenDays.toISOString().slice(0, 10)] },
        expiry_notified_at: null,
      },
    });

    for (const doc of soonDocs) {
      try {
        const folder = await Folder.findByPk(doc.folder_id);
        if (!folder) continue;
        const user = await User.findByPk(folder.user_id);
        if (!user) continue;
        const type = await DocumentType.findOne({ where: { code: doc.document_type } });
        const label = type?.label_fr ?? doc.document_type;
        const expDate = doc.expires_at ? new Date(doc.expires_at) : now;
        const days = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / 86400000));
        try {
          const r = await NotificationService.notifyDocumentExpiringSoon(user.id, label, days);
          if (r === null) {
            await sendDocumentExpiringSoon(user.email, label, days);
          }
        } catch {
          await sendDocumentExpiringSoon(user.email, label, days);
        }
        await doc.update({ expiry_notified_at: new Date() });
        alertsSent += 1;
      } catch {
        errors += 1;
      }
    }

    const expiredDocs = await Document.findAll({
      where: {
        status: { [Op.ne]: 'expired' },
        expires_at: { [Op.lt]: now.toISOString().slice(0, 10) },
      },
    });

    for (const doc of expiredDocs) {
      try {
        const folder = await Folder.findByPk(doc.folder_id);
        if (!folder) continue;
        const user = await User.findByPk(folder.user_id);
        if (!user) continue;
        const type = await DocumentType.findOne({ where: { code: doc.document_type } });
        const label = type?.label_fr ?? doc.document_type;
        await doc.update({ status: 'expired', deleted_at: new Date() });
        await S3Service.deleteFile(doc.file_path);
        try {
          const r = await NotificationService.notifyDocumentExpired(user.id, label);
          if (r === null) {
            await sendDocumentExpired(user.email, label);
          }
        } catch {
          await sendDocumentExpired(user.email, label);
        }
        if (user.tenant_profile) {
          await FolderService.calculateCompletion(folder.id, user.tenant_profile);
        }
        expiredCount += 1;
      } catch {
        errors += 1;
      }
    }

    logger.info(
      `Document expiry job done alerts_sent=${alertsSent} documents_expired=${expiredCount} errors=${errors}`
    );
  } catch {
    logger.error('Document expiry job failed');
  }
}

cron.schedule('0 3 * * *', async () => {
  await runDocumentExpiryJob();
});
