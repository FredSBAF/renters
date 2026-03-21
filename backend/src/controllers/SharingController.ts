import { Request, Response } from 'express';
import { FolderService } from '../services/FolderService';
import { SharingService } from '../services/SharingService';
import { errorResponse, successResponse } from '../utils/response';
import {
  consultFolderSchema,
  createSharingLinkSchema,
  trackDownloadSchema,
} from '../validators/sharing.validator';

export class SharingController {
  static async createLink(req: Request, res: Response): Promise<Response> {
    const { error, value } = createSharingLinkSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        'Validation échouée',
        error.details.map((d) => d.message),
        400
      );
    }
    try {
      const folder = await FolderService.getOrCreateFolder(req.user!.id);
      const link = await SharingService.createSharingLink({
        folderId: folder.id,
        userId: req.user!.id,
        context: value.context,
      });
      return successResponse(
        res,
        {
          id: link.id,
          url: (link as unknown as { url: string }).url,
          expires_at: link.expires_at,
          created_at: link.created_at,
          context: link.context,
        },
        'Lien de partage créé',
        201
      );
    } catch (e) {
      if (e instanceof Error && e.message === 'FOLDER_NOT_ACTIVE') {
        return errorResponse(res, 'Le dossier doit être actif pour être partagé', [], 400);
      }
      return errorResponse(res, 'Erreur création lien', [], 500);
    }
  }

  static async getMyLinks(req: Request, res: Response): Promise<Response> {
    const links = await SharingService.getSharingLinks(req.user!.id);
    return successResponse(res, { links }, 'Liens récupérés', 200);
  }

  static async revokeLink(req: Request, res: Response): Promise<Response> {
    try {
      await SharingService.revokeSharingLink(req.params.linkId, req.user!.id);
      return res.status(204).send();
    } catch (e) {
      if (e instanceof Error && e.message === 'ALREADY_REVOKED') {
        return errorResponse(res, 'Lien déjà révoqué', [], 400);
      }
      if (e instanceof Error && e.message === 'FORBIDDEN') {
        return errorResponse(res, 'Action non autorisée', [], 403);
      }
      return errorResponse(res, 'Lien introuvable', [], 404);
    }
  }

  static async extendLink(req: Request, res: Response): Promise<Response> {
    try {
      const link = await SharingService.extendSharingLink(req.params.linkId, req.user!.id);
      return successResponse(res, { link }, 'Lien prolongé de 30 jours', 200);
    } catch (e) {
      if (e instanceof Error && e.message === 'ALREADY_REVOKED') {
        return errorResponse(res, 'Impossible de prolonger un lien révoqué', [], 400);
      }
      if (e instanceof Error && e.message === 'FORBIDDEN') {
        return errorResponse(res, 'Action non autorisée', [], 403);
      }
      return errorResponse(res, 'Lien introuvable', [], 404);
    }
  }

  static async getSharingHistory(req: Request, res: Response): Promise<Response> {
    const history = await SharingService.getSharingHistory(req.user!.id);
    return successResponse(res, { history }, 'Historique récupéré', 200);
  }

  static async consultFolder(req: Request, res: Response): Promise<Response> {
    const { error, value } = consultFolderSchema.validate(req.query, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        'Validation échouée',
        error.details.map((d) => d.message),
        400
      );
    }

    let agencyId: number | undefined;
    if (req.user) {
      if (req.user.role === 'tenant') {
        return errorResponse(res, 'Accès non autorisé', [], 403);
      }
      if (req.user.role === 'agency_owner' || req.user.role === 'agency_agent') {
        agencyId = req.user.agencyId ?? undefined;
      }
    }

    try {
      const data = await SharingService.consultFolder({
        linkId: req.params.linkId,
        requestingAgencyId: agencyId,
        viewerEmail: value.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      });
      return successResponse(res, { folder: data.folder, accessLevel: data.accessLevel }, 'Dossier partagé récupéré', 200);
    } catch (e) {
      if (e instanceof Error && e.message === 'LINK_GONE') {
        return errorResponse(res, 'Lien expiré ou révoqué', [], 410);
      }
      return errorResponse(res, 'Lien introuvable', [], 404);
    }
  }

  static async trackDownload(req: Request, res: Response): Promise<Response> {
    const { error, value } = trackDownloadSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        'Validation échouée',
        error.details.map((d) => d.message),
        400
      );
    }
    try {
      await SharingService.trackDocumentDownload({
        linkId: value.link_id,
        documentId: value.document_id,
        agencyId: req.user!.agencyId!,
      });
      return successResponse(res, null, 'Téléchargement tracé', 200);
    } catch {
      return errorResponse(res, 'Impossible de tracer le téléchargement', [], 400);
    }
  }
}
