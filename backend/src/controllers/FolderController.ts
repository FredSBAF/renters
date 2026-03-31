import { Request, Response } from 'express';
import { DocumentType, User } from '../models';
import { FolderService } from '../services/FolderService';
import { errorResponse, successResponse } from '../utils/response';
import { getRequiredDocsSchema, updateFolderStatusSchema } from '../validators/folder.validator';

export class FolderController {
  private static stripSequelizeCamelTimestamps<T extends Record<string, unknown>>(obj: T): T {
    const clone = { ...obj };
    delete clone.createdAt;
    delete clone.updatedAt;
    delete clone.deletedAt;
    return clone as T;
  }

  private static workflowWeight(status: string): number {
    switch (status) {
      case 'uploaded':
        return 0.33;
      case 'analyzed':
        return 0.66;
      case 'validated':
        return 1;
      default:
        return 0;
    }
  }

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

      const rawFolder =
        typeof (folder as unknown as { toJSON?: () => unknown }).toJSON === 'function'
          ? ((folder as unknown as { toJSON: () => unknown }).toJSON() as Record<string, unknown>)
          : (folder as unknown as Record<string, unknown>);
      const folderPayload = FolderController.stripSequelizeCamelTimestamps(rawFolder);
      const requiredDocumentsPayload = requiredDocuments.map((doc) =>
        FolderController.stripSequelizeCamelTimestamps(doc as Record<string, unknown>)
      );

      return successResponse(
        res,
        {
          folder: folderPayload,
          completion_percentage: completion,
          required_documents: requiredDocumentsPayload,
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

  static async getMyDashboardKpis(req: Request, res: Response): Promise<Response> {
    try {
      const user = await User.findByPk(req.user!.id);
      if (!user) return errorResponse(res, 'Utilisateur introuvable', [], 404);
      if (user.role !== 'tenant') return errorResponse(res, 'Action non autorisée', [], 403);

      const folder = await FolderService.getOrCreateFolder(user.id);
      const requiredDocuments = user.tenant_profile
        ? await FolderService.getDocumentPresenceDetails(folder.id, user.tenant_profile)
        : [];

      const totalDocs = requiredDocuments.length;
      const weightedPoints = requiredDocuments.reduce(
        (sum, doc) => sum + FolderController.workflowWeight(doc.workflow_status),
        0
      );
      const dossierCompletionPercentage =
        totalDocs === 0 ? 0 : Math.round((weightedPoints / totalDocs) * 100);

      const profileFields = {
        first_name: !!user.first_name,
        last_name: !!user.last_name,
        email: !!user.email,
        phone: !!user.phone,
        address: !!(user.toJSON() as Record<string, unknown>).address,
        date_of_birth: !!user.date_of_birth,
        tenant_profile: !!user.tenant_profile,
      };
      const totalProfileFields = Object.keys(profileFields).length;
      const completedProfileFields = Object.values(profileFields).filter(Boolean).length;
      const profileCompletionPercentage = Math.round(
        (completedProfileFields / totalProfileFields) * 100
      );

      return successResponse(
        res,
        {
          dossier_completion: {
            percentage: dossierCompletionPercentage,
            total_expected_documents: totalDocs,
            weighted_points: Number(weightedPoints.toFixed(2)),
          },
          profile_completion: {
            percentage: profileCompletionPercentage,
            completed_fields: completedProfileFields,
            total_fields: totalProfileFields,
            fields: profileFields,
          },
          search_criteria_indicator: null,
          shared_folders_count: null,
        },
        'KPIs dashboard récupérés',
        200
      );
    } catch (err) {
      return errorResponse(
        res,
        `Erreur KPI dashboard: ${err instanceof Error ? err.message : 'unknown'}`,
        [],
        500
      );
    }
  }
}
