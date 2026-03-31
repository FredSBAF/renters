import { AuditLog, Document, DocumentType, Folder, User } from '../models';

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

export async function recalculateFolderCompletion(userId: number): Promise<void> {
  const user = await User.findByPk(userId);
  if (!user || !user.tenant_profile) return;

  const folder = await Folder.findOne({ where: { user_id: userId, deleted_at: null } });
  if (!folder) return;

  const requiredTypes = await DocumentType.findAll({ where: { is_required: true } });
  const requiredCodes = requiredTypes
    .filter((docType) => {
      const profiles = normalizeProfiles(docType.required_for_profiles);
      return profiles.includes('all') || profiles.includes(user.tenant_profile!);
    })
    .map((docType) => docType.code);

  const docs = await Document.findAll({
    where: {
      folder_id: folder.id,
      deleted_at: null,
    },
  });

  const presentCodes = new Set(docs.map((d) => d.document_type));
  const allRequiredPresent =
    requiredCodes.length > 0 &&
    requiredCodes.every((code) => presentCodes.has(code));

  const allRequiredValid =
    requiredCodes.length > 0 &&
    requiredCodes.every((code) => docs.some((d) => d.document_type === code && d.status === 'valid'));

  const oldPercentage = folder.completion_percentage;
  const newPercentage =
    requiredCodes.length === 0
      ? 0
      : Math.round((requiredCodes.filter((code) => presentCodes.has(code)).length / requiredCodes.length) * 100);

  await folder.update({
    completion_percentage: newPercentage,
    status: allRequiredPresent && allRequiredValid ? 'complete' : 'incomplete',
  });

  await AuditLog.create({
    user_id: userId,
    action: 'folder.completion_recalculated',
    entity_type: 'folder',
    entity_id: folder.id,
    details: {
      old_percentage: oldPercentage,
      new_percentage: newPercentage,
      new_profile: user.tenant_profile,
    } as unknown as object,
  });
}
