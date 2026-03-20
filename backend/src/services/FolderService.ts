import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { DocumentType, Folder, User } from '../models';
import { logger } from '../utils/logger';

type FolderStatus = 'active' | 'standby' | 'archived';

type RequiredDocumentType = {
  id: number;
  code: string;
  label_fr: string;
  label_en: string;
  validity_months: number | null;
  is_required: boolean;
  required_for_profiles: string[];
  sort_order: number;
};

type FolderDocumentCoverage = {
  valid: Set<string>;
  expired: Set<string>;
};

const CATEGORY_MAP: Record<string, string[]> = {
  identity: ['identity_card', 'passport', 'residence_permit'],
  residence: ['proof_of_residence'],
  professional: [
    'employment_contract',
    'kbis',
    'student_card',
    'scholarship_proof',
    'pension_statement',
  ],
  income: ['payslip', 'balance_sheet', 'tax_notice'],
  other: ['bank_details'],
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function includesProfile(requiredProfiles: string[], tenantProfile: string): boolean {
  return requiredProfiles.includes('all') || requiredProfiles.includes(tenantProfile);
}

function normalizeProfiles(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [value];
    }
  }
  return [];
}

export class FolderService {
  private static async getFolderDocumentCoverage(folderId: number): Promise<FolderDocumentCoverage> {
    try {
      const rows = (await sequelize.query(
        `
          SELECT document_type, status
          FROM documents
          WHERE folder_id = :folderId
            AND deleted_at IS NULL
        `,
        {
          replacements: { folderId },
          type: QueryTypes.SELECT,
        }
      )) as Array<{ document_type: string; status: string }>;

      const valid = new Set<string>();
      const expired = new Set<string>();
      for (const row of rows) {
        if (row.status === 'valid' || row.status === 'attention') {
          valid.add(row.document_type);
        }
        if (row.status === 'expired') {
          expired.add(row.document_type);
        }
      }
      return { valid, expired };
    } catch {
      // Document model/table arrives in Part 5.
      return { valid: new Set<string>(), expired: new Set<string>() };
    }
  }

  static async getOrCreateFolder(userId: number): Promise<Folder> {
    const existing = await Folder.findOne({
      where: {
        user_id: userId,
      },
    });
    if (existing && existing.folder_status !== 'archived' && !existing.deleted_at) {
      return existing;
    }

    const expiresAt = addMonths(new Date(), 6);
    const created = await Folder.create({
      user_id: userId,
      status: 'incomplete',
      completion_percentage: 0,
      folder_status: 'active',
      expires_at: expiresAt,
    });
    logger.info(`Folder created for user=${userId} folder=${created.id}`);
    return created;
  }

  static async calculateCompletion(folderId: number, tenantProfile: string): Promise<number> {
    const requiredTypes = await DocumentType.findAll({
      where: { is_required: true },
      order: [['sort_order', 'ASC']],
    });
    const required = requiredTypes.filter((dt) =>
      includesProfile(normalizeProfiles(dt.required_for_profiles), tenantProfile)
    );

    const coverage = await FolderService.getFolderDocumentCoverage(folderId);
    const requiredCodes = required.map((r) => r.code);
    const coveredCount = requiredCodes.filter((code) => coverage.valid.has(code)).length;
    const completion =
      requiredCodes.length === 0 ? 0 : Math.round((coveredCount / requiredCodes.length) * 100);

    const folder = await Folder.findByPk(folderId);
    if (!folder) throw new Error('FOLDER_NOT_FOUND');
    const nextStatus = completion === 100 && folder.status === 'incomplete' ? 'complete' : folder.status;
    await folder.update({
      completion_percentage: completion,
      status: nextStatus,
    });
    return completion;
  }

  static async updateFolderStatus(folderId: number, folderStatus: FolderStatus): Promise<Folder> {
    const folder = await Folder.findByPk(folderId);
    if (!folder || folder.deleted_at) {
      throw new Error('FOLDER_NOT_FOUND');
    }

    const payload: Partial<Folder> = {
      folder_status: folderStatus,
      expires_at: addMonths(new Date(), 6),
    };
    if (folderStatus === 'archived') {
      payload.deleted_at = new Date();
    }

    await folder.update(payload);
    logger.info(`Folder status updated folder=${folderId} status=${folderStatus}`);
    return folder;
  }

  static async getFolderWithDetails(folderId: number): Promise<Folder> {
    const folder = await Folder.findOne({
      where: { id: folderId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: { exclude: ['password_hash', 'totp_secret'] },
        },
      ],
    });

    if (!folder || folder.deleted_at) {
      throw new Error('FOLDER_NOT_FOUND');
    }

    return folder;
  }

  static async getRequiredDocumentTypes(tenantProfile: string): Promise<RequiredDocumentType[]> {
    const allTypes = await DocumentType.findAll({
      order: [['sort_order', 'ASC']],
    });

    return allTypes
      .map((dt) => {
        const json = dt.toJSON() as RequiredDocumentType;
        const profiles = normalizeProfiles(json.required_for_profiles);
        return {
          ...json,
          required_for_profiles: profiles,
          is_required: json.is_required && includesProfile(profiles, tenantProfile),
        };
      })
      .filter((dt) => {
        if (dt.required_for_profiles.includes('all')) return true;
        return dt.required_for_profiles.includes(tenantProfile);
      });
  }

  static async getRequiredDocumentTypesGrouped(tenantProfile: string): Promise<Record<string, RequiredDocumentType[]>> {
    const types = await FolderService.getRequiredDocumentTypes(tenantProfile);
    const grouped: Record<string, RequiredDocumentType[]> = {
      identity: [],
      residence: [],
      professional: [],
      income: [],
      other: [],
    };

    for (const doc of types) {
      const category =
        Object.keys(CATEGORY_MAP).find((cat) => CATEGORY_MAP[cat].includes(doc.code)) ?? 'other';
      grouped[category].push(doc);
    }
    return grouped;
  }

  static async refreshExpiry(folderId: number): Promise<void> {
    const folder = await Folder.findByPk(folderId);
    if (!folder) throw new Error('FOLDER_NOT_FOUND');
    await folder.update({ expires_at: addMonths(new Date(), 6) });
  }

  static async getFolderForSharing(
    folderId: number,
    accessLevel: 'limited' | 'full'
  ): Promise<Record<string, unknown>> {
    const folder = await FolderService.getFolderWithDetails(folderId);
    const user = (folder as unknown as { user?: User }).user;
    if (!user) throw new Error('FOLDER_NOT_FOUND');

    if (accessLevel === 'limited') {
      const age =
        user.date_of_birth
          ? Math.floor(
              (Date.now() - new Date(user.date_of_birth).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : null;
      return {
        tenant: {
          first_name: user.first_name,
          age,
          situation: user.tenant_profile,
        },
        ai_score_global: null,
        documents: [],
      };
    }

    return {
      tenant: {
        first_name: user.first_name,
        last_name: user.last_name,
        date_of_birth: user.date_of_birth,
        phone: user.phone,
        email: user.email,
        tenant_profile: user.tenant_profile,
      },
      ai_score_global: folder.ai_score_global,
      ai_score_identity: folder.ai_score_identity,
      ai_score_income: folder.ai_score_income,
      ai_score_stability: folder.ai_score_stability,
      ai_score_coherence: folder.ai_score_coherence,
      ai_status: folder.ai_status,
      ai_warnings: folder.ai_warnings,
      documents: [],
    };
  }

  static async getMissingDocuments(folderId: number, tenantProfile: string): Promise<string[]> {
    const requiredTypes = await FolderService.getRequiredDocumentTypes(tenantProfile);
    const coverage = await FolderService.getFolderDocumentCoverage(folderId);
    return requiredTypes
      .filter((dt) => dt.is_required)
      .map((dt) => dt.code)
      .filter((code) => !coverage.valid.has(code));
  }

  static async getDocumentPresenceDetails(
    folderId: number,
    tenantProfile: string
  ): Promise<Array<RequiredDocumentType & { document_status: 'present' | 'missing' | 'expired' }>> {
    const requiredTypes = await FolderService.getRequiredDocumentTypes(tenantProfile);
    const coverage = await FolderService.getFolderDocumentCoverage(folderId);

    return requiredTypes.map((doc) => {
      let document_status: 'present' | 'missing' | 'expired' = 'missing';
      if (coverage.valid.has(doc.code)) document_status = 'present';
      else if (coverage.expired.has(doc.code)) document_status = 'expired';
      return { ...doc, document_status };
    });
  }
}
