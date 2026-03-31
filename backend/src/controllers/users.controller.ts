import { Request, Response } from 'express';
import { AuditLog, User } from '../models';
import { successResponse, errorResponse } from '../utils/response';
import { updateProfileSchema } from '../validators/user.validators';
import { recalculateFolderCompletion } from '../services/folder.service';

export async function getMe(req: Request, res: Response): Promise<Response> {
  const user = await User.findByPk(req.user!.id);
  if (!user || user.deleted_at) {
    return errorResponse(res, 'Utilisateur introuvable', [], 404);
  }
  return successResponse(res, user.toPublicJSON(), 'Profil récupéré', 200);
}

export async function updateMe(req: Request, res: Response): Promise<Response> {
  const { error, value } = updateProfileSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((d) => d.message);
    return errorResponse(res, 'Données invalides', errors, 400);
  }

  const user = await User.findByPk(req.user!.id);
  if (!user || user.deleted_at) {
    return errorResponse(res, 'Utilisateur introuvable', [], 404);
  }

  const oldProfile = user.tenant_profile;
  await user.update(value);

  if (value.tenant_profile !== undefined && value.tenant_profile !== oldProfile) {
    await AuditLog.create({
      user_id: user.id,
      action: 'profile.tenant_profile_updated',
      entity_type: 'user',
      entity_id: user.id,
      details: {
        old_profile: oldProfile,
        new_profile: value.tenant_profile,
      } as unknown as object,
    });
    await recalculateFolderCompletion(user.id);
  }

  return successResponse(res, user.toPublicJSON(), 'Profil mis à jour', 200);
}
