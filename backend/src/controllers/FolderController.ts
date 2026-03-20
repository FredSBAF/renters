import { Request, Response } from 'express';
import { DocumentType, User } from '../models';
import { FolderService } from '../services/FolderService';
import { errorResponse, successResponse } from '../utils/response';
import { getRequiredDocsSchema, updateFolderStatusSchema } from '../validators/folder.validator';

export class FolderController {
  static async getMyFolder(req: Request, res: Response): Promise<Response> {
    try {
      const user = await User.findByPk(req.user!.id);
      if (!user) return errorResponse(res, 'Utilisateur introuvable', [], 404);
      if (user.role !== 'tenant') return errorResponse(res, 'Action non autorisée', [], 403);

      const folder = await FolderService.getOrCreateFolder(user.id);
      const completion = user.tenant_profile
        ? await FolderService.calculateCompletion(folder.id, user.tenant_profile)
        : folder.completion_percentage;
      const requiredDocuments = user.tenant_profile
        ? await FolderService.getDocumentPresenceDetails(folder.id, user.tenant_profile)
        : [];

      return successResponse(
        res,
        {
          folder,
          completion_percentage: completion,
          required_documents: requiredDocuments,
        },
        'Dossier récupéré',
        200
      );
    } catch (err) {
      return errorResponse(res, `Erreur dossier: ${err instanceof Error ? err.message : 'unknown'}`, [], 500);
    }
  }

  static async updateFolderStatus(req: Request, res: Response): Promise<Response> {
    const { error, value } = updateFolderStatusSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        'Validation échouée',
        error.details.map((d) => d.message),
        400
      );
    }

    const folder = await FolderService.getOrCreateFolder(req.user!.id);
    const updated = await FolderService.updateFolderStatus(folder.id, value.folder_status);
    return successResponse(res, { folder: updated }, 'Statut du dossier mis à jour', 200);
  }

  static async getRequiredDocuments(req: Request, res: Response): Promise<Response> {
    const { error, value } = getRequiredDocsSchema.validate(req.query, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        'Validation échouée',
        error.details.map((d) => d.message),
        400
      );
    }

    const user = await User.findByPk(req.user!.id);
    if (!user) return errorResponse(res, 'Utilisateur introuvable', [], 404);
    const profile = value.profile || user.tenant_profile;
    if (!profile) {
      return errorResponse(res, "Veuillez d'abord définir votre profil", [], 400);
    }

    const grouped = await FolderService.getRequiredDocumentTypesGrouped(profile);
    return successResponse(res, grouped, 'Documents requis récupérés', 200);
  }

  static async getDocumentTypes(req: Request, res: Response): Promise<Response> {
    const types = await DocumentType.findAll({ order: [['sort_order', 'ASC']] });
    return successResponse(res, { document_types: types }, 'Types de documents récupérés', 200);
  }

  static async getFolderCompletion(req: Request, res: Response): Promise<Response> {
    const user = await User.findByPk(req.user!.id);
    if (!user) return errorResponse(res, 'Utilisateur introuvable', [], 404);
    if (!user.tenant_profile) {
      return errorResponse(res, "Veuillez d'abord définir votre profil", [], 400);
    }

    const folder = await FolderService.getOrCreateFolder(req.user!.id);
    const completion = await FolderService.calculateCompletion(folder.id, user.tenant_profile);
    const missing = await FolderService.getMissingDocuments(folder.id, user.tenant_profile);
    return successResponse(
      res,
      {
        completion_percentage: completion,
        status: folder.status,
        missing_documents: missing,
      },
      'Complétion du dossier recalculée',
      200
    );
  }
}
