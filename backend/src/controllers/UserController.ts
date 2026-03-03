import { Request, Response } from 'express';
import { User } from '../models';
import { successResponse, errorResponse } from '../utils/response';
import { patchMeSchema } from '../validators/user.validator';

export async function getMe(req: Request, res: Response): Promise<Response> {
  const user = await User.findByPk(req.user!.id, {
    attributes: [
      'id',
      'email',
      'first_name',
      'last_name',
      'phone',
      'date_of_birth',
      'tenant_profile',
      'is_2fa_enabled',
      'created_at',
    ],
  });
  if (!user) {
    return errorResponse(res, 'Utilisateur introuvable', [], 404);
  }
  const data = {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    date_of_birth: user.date_of_birth,
    tenant_profile: user.tenant_profile,
    is_2fa_enabled: user.is_2fa_enabled,
    created_at: user.created_at,
  };
  return successResponse(res, data, 'Profil récupéré', 200);
}

export async function patchMe(req: Request, res: Response): Promise<Response> {
  const { error, value } = patchMeSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return errorResponse(res, 'Validation échouée', messages, 400);
  }
  const user = await User.findByPk(req.user!.id);
  if (!user) {
    return errorResponse(res, 'Utilisateur introuvable', [], 404);
  }
  const updates: Record<string, unknown> = {};
  if (value.first_name !== undefined) updates.first_name = value.first_name || null;
  if (value.last_name !== undefined) updates.last_name = value.last_name || null;
  if (value.phone !== undefined) updates.phone = value.phone || null;
  if (value.tenant_profile !== undefined) updates.tenant_profile = value.tenant_profile;
  if (value.date_of_birth !== undefined) updates.date_of_birth = value.date_of_birth;
  await user.update(updates);
  const data = {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    date_of_birth: user.date_of_birth,
    tenant_profile: user.tenant_profile,
    is_2fa_enabled: user.is_2fa_enabled,
    created_at: user.created_at,
  };
  return successResponse(res, data, 'Profil mis à jour', 200);
}
