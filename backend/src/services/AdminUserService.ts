import archiver from 'archiver';
import { Op } from 'sequelize';
import { PassThrough } from 'stream';
import {
  Agency,
  AuditLog,
  Document,
  EmailVerificationToken,
  Folder,
  Guarantor,
  RefreshToken,
  SharingLink,
  SharingView,
  User,
  UserConsent,
} from '../models';
import { S3Service } from './S3Service';
import { sendAccountDeleted, sendAccountReactivated, sendAccountSuspended } from './EmailService';

export class AdminUserService {
  static async searchUsers(params: {
    search?: string;
    role?: string;
    status?: string;
    is_fraud_flagged?: boolean;
    agency_id?: number;
    page: number;
    limit: number;
    sort_by?: 'created_at' | 'last_login_at' | 'email';
    sort_order?: 'ASC' | 'DESC';
  }): Promise<{ users: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    const where: Record<string | symbol, unknown> = {};
    if (params.role) where.role = params.role;
    if (params.status) where.status = params.status;
    if (params.agency_id) where.agency_id = params.agency_id;
    if (params.is_fraud_flagged !== undefined) {
      where.is_fraud_flagged = params.is_fraud_flagged;
    }
    if (params.search) {
      where[Op.or] = [
        { email: { [Op.like]: `%${params.search}%` } },
        { first_name: { [Op.like]: `%${params.search}%` } },
        { last_name: { [Op.like]: `%${params.search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      include: [{ model: Agency }, { model: Folder, as: 'folder' }],
      order: [[params.sort_by ?? 'created_at', params.sort_order ?? 'DESC']],
      offset: (params.page - 1) * params.limit,
      limit: params.limit,
      attributes: { exclude: ['password_hash', 'totp_secret'] },
    });

    return {
      users: rows.map((u) => u.toJSON() as Record<string, unknown>),
      total: count,
      page: params.page,
      limit: params.limit,
    };
  }

  static async getUserDetails(userId: number): Promise<Record<string, unknown>> {
    const user = await User.findByPk(userId, { attributes: { exclude: ['password_hash', 'totp_secret'] } });
    if (!user) throw new Error('NOT_FOUND');
    const agency = user.agency_id ? await Agency.findByPk(user.agency_id) : null;
    const folder = await Folder.findOne({ where: { user_id: user.id }, include: [{ model: Document, as: 'documents' }] });
    const activities = await AuditLog.findAll({ where: { user_id: user.id }, order: [['created_at', 'DESC']], limit: 20 });
    const consents = await UserConsent.findAll({ where: { user_id: user.id } });
    return {
      user,
      agency,
      folder,
      activities,
      consents,
    };
  }

  static async suspendUser(userId: number, adminId: number, reason: string): Promise<void> {
    if (userId === adminId) throw new Error('SELF');
    const user = await User.findByPk(userId);
    if (!user) throw new Error('NOT_FOUND');
    if (user.role === 'admin') throw new Error('FORBIDDEN');
    await user.update({ status: 'suspended' });
    await RefreshToken.destroy({ where: { user_id: userId } });
    await AuditLog.create({
      user_id: userId,
      action: 'admin.user.suspended',
      details: { reason, suspended_by: adminId } as unknown as object,
    });
    await sendAccountSuspended(user.email, reason);
  }

  static async reactivateUser(userId: number, adminId: number): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('NOT_FOUND');
    await user.update({ status: 'active' });
    await AuditLog.create({
      user_id: userId,
      action: 'admin.user.reactivated',
      details: { reactivated_by: adminId } as unknown as object,
    });
    await sendAccountReactivated(user.email);
  }

  static async deleteUser(userId: number, adminId: number): Promise<void> {
    if (userId === adminId) throw new Error('SELF');
    const user = await User.findByPk(userId);
    if (!user) throw new Error('NOT_FOUND');
    if (user.role === 'admin') throw new Error('FORBIDDEN');

    const folder = await Folder.findOne({ where: { user_id: userId } });
    const documents = folder ? await Document.findAll({ where: { folder_id: folder.id } }) : [];
    for (const doc of documents) {
      try {
        await S3Service.deleteFile(doc.file_path);
      } catch {
        // continue
      }
      await doc.update({ deleted_at: new Date() });
    }
    if (folder) {
      await SharingLink.destroy({ where: { folder_id: folder.id } });
      await SharingView.destroy({ where: { sharing_link_id: { [Op.in]: [] } } });
      await Folder.destroy({ where: { id: folder.id }, force: true });
    }
    await RefreshToken.destroy({ where: { user_id: userId } });
    await EmailVerificationToken.destroy({ where: { user_id: userId } });
    await UserConsent.destroy({ where: { user_id: userId } });
    await Guarantor.destroy({ where: { tenant_id: userId } });
    await AuditLog.update(
      { user_id: null, ip_address: '0.0.0.0' } as never,
      { where: { user_id: userId } }
    );
    await user.update({
      status: 'deleted',
      email: `deleted_${user.id}@renters.deleted`,
      first_name: 'Supprime',
      last_name: 'Supprime',
      phone: null,
      date_of_birth: null,
      deleted_at: new Date(),
    } as never);
    await AuditLog.create({
      action: 'admin.user.deleted',
      details: { admin_id: adminId, deleted_user_id: userId } as unknown as object,
    });
    await sendAccountDeleted(user.email);
  }

  static async exportUserData(userId: number): Promise<Buffer> {
    const data = await AdminUserService.getUserDetails(userId);
    const archive = archiver('zip', { zlib: { level: 9 } });
    const passthrough = new PassThrough();
    const chunks: Buffer[] = [];
    passthrough.on('data', (c) => chunks.push(Buffer.from(c)));
    archive.pipe(passthrough);
    archive.append(JSON.stringify(data, null, 2), { name: 'user_data.json' });
    const folder = data.folder as Folder | null;
    if (folder) {
      const docs = await Document.findAll({ where: { folder_id: folder.id } });
      for (const d of docs) {
        try {
          const b = await S3Service.getFileBuffer(d.file_path);
          archive.append(b, { name: `documents/${d.file_name}` });
        } catch {
          // ignore missing files
        }
      }
    }
    await archive.finalize();
    await new Promise((resolve) => passthrough.on('end', resolve));
    return Buffer.concat(chunks);
  }

  static async changeUserRole(userId: number, newRole: string, adminId: number): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('NOT_FOUND');
    await user.update({ role: newRole as never });
    await AuditLog.create({
      user_id: userId,
      action: 'admin.user.role_changed',
      details: { new_role: newRole, changed_by: adminId } as unknown as object,
    });
  }

  static async getAuditLogs(params: {
    userId?: number;
    agencyId?: number;
    action?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.userId) where.user_id = params.userId;
    if (params.agencyId) where.agency_id = params.agencyId;
    if (params.action) where.action = params.action;
    if (params.from || params.to) {
      where.created_at = {
        [Op.between]: [
          params.from ? new Date(params.from) : new Date('1970-01-01'),
          params.to ? new Date(params.to) : new Date(),
        ],
      };
    }
    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: 'user' }, { model: Agency, as: 'agency' }],
      order: [['created_at', 'DESC']],
      offset: (params.page - 1) * params.limit,
      limit: params.limit,
    });
    return { logs: rows, total: count };
  }
}
