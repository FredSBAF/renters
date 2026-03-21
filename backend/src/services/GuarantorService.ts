import { v4 as uuidv4 } from 'uuid';
import { AuditLog, Folder, Guarantor, User } from '../models';
import { sendGuarantorInvitation } from './EmailService';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export class GuarantorService {
  static async inviteGuarantor(params: {
    tenantId: number;
    email: string;
    role: 'guarantor' | 'co_tenant' | 'spouse';
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<Guarantor> {
    const tenant = await User.findByPk(params.tenantId);
    if (!tenant || tenant.role !== 'tenant' || tenant.status !== 'active') {
      throw new Error('FORBIDDEN');
    }
    const existingSameTenant = await Guarantor.findOne({
      where: { tenant_id: params.tenantId, email: params.email.toLowerCase() },
    });
    if (existingSameTenant) throw new Error('DUPLICATE');

    const existingUser = await User.findOne({ where: { email: params.email.toLowerCase() } });
    let guarantorUserId: number | null = null;
    let acceptedAt: Date | null = null;
    let token: string | null = null;
    let tokenExpiresAt: Date | null = null;

    if (existingUser) {
      const linkedElsewhere = await Guarantor.findOne({
        where: { guarantor_user_id: existingUser.id },
      });
      if (linkedElsewhere) throw new Error('ALREADY_LINKED');
      guarantorUserId = existingUser.id;
      acceptedAt = new Date();
    } else {
      token = uuidv4();
      tokenExpiresAt = addDays(new Date(), 7);
    }

    const guarantor = await Guarantor.create({
      tenant_id: params.tenantId,
      guarantor_user_id: guarantorUserId,
      role: params.role,
      first_name: params.firstName ?? null,
      last_name: params.lastName ?? null,
      email: params.email.toLowerCase(),
      phone: params.phone ?? null,
      invitation_token: token,
      invitation_expires_at: tokenExpiresAt,
      invitation_accepted_at: acceptedAt,
    });

    await sendGuarantorInvitation(
      params.email.toLowerCase(),
      `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() || tenant.email,
      params.role,
      token ?? ''
    );
    await AuditLog.create({
      user_id: params.tenantId,
      action: 'guarantor.invited',
      entity_type: 'guarantor',
      entity_id: guarantor.id,
    });
    return guarantor;
  }

  static async uploadGuarantorDocumentsDirect(params: {
    tenantId: number;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    role: 'guarantor' | 'co_tenant' | 'spouse';
  }): Promise<Guarantor> {
    const tenant = await User.findByPk(params.tenantId);
    if (!tenant || tenant.role !== 'tenant') throw new Error('FORBIDDEN');

    const folder = await Folder.create({
      user_id: tenant.id,
      status: 'incomplete',
      completion_percentage: 0,
      folder_status: 'active',
      expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });

    return Guarantor.create({
      tenant_id: params.tenantId,
      role: params.role,
      first_name: params.firstName,
      last_name: params.lastName,
      email: params.email?.toLowerCase() ?? null,
      phone: params.phone ?? null,
      folder_id: folder.id,
    });
  }

  static async acceptInvitation(token: string, userId: number): Promise<Guarantor> {
    const guarantor = await Guarantor.findOne({ where: { invitation_token: token } });
    if (!guarantor) throw new Error('NOT_FOUND');
    if (!guarantor.invitation_expires_at || new Date(guarantor.invitation_expires_at) < new Date()) {
      throw new Error('EXPIRED');
    }

    let folderId = guarantor.folder_id;
    if (!folderId) {
      const folder = await Folder.create({
        user_id: userId,
        status: 'incomplete',
        completion_percentage: 0,
        folder_status: 'active',
        expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      });
      folderId = folder.id;
    }

    await guarantor.update({
      guarantor_user_id: userId,
      invitation_accepted_at: new Date(),
      invitation_token: null,
      folder_id: folderId,
    });
    return guarantor;
  }

  static async getGuarantors(tenantId: number): Promise<Guarantor[]> {
    return Guarantor.findAll({ where: { tenant_id: tenantId }, order: [['created_at', 'DESC']] });
  }

  static async removeGuarantor(guarantorId: number, tenantId: number): Promise<void> {
    const guarantor = await Guarantor.findByPk(guarantorId);
    if (!guarantor || guarantor.tenant_id !== tenantId) throw new Error('FORBIDDEN');
    await guarantor.destroy();
    await AuditLog.create({
      user_id: tenantId,
      action: 'guarantor.removed',
      entity_type: 'guarantor',
      entity_id: guarantorId,
    });
  }

  static async getGuarantorFolder(guarantorId: number, tenantId: number): Promise<Folder> {
    const guarantor = await Guarantor.findByPk(guarantorId);
    if (!guarantor || guarantor.tenant_id !== tenantId || !guarantor.folder_id) {
      throw new Error('FORBIDDEN');
    }
    const folder = await Folder.findByPk(guarantor.folder_id);
    if (!folder) throw new Error('NOT_FOUND');
    return folder;
  }
}
