import { Request, Response } from 'express';
import { GuarantorService } from '../services/GuarantorService';
import { errorResponse, successResponse } from '../utils/response';
import {
  acceptInvitationSchema,
  inviteGuarantorSchema,
  uploadGuarantorDirectSchema,
} from '../validators/guarantor.validator';

export class GuarantorController {
  static async inviteGuarantor(req: Request, res: Response): Promise<Response> {
    const { error, value } = inviteGuarantorSchema.validate(req.body, { abortEarly: false });
    if (error) return errorResponse(res, 'Validation échouée', error.details.map((d) => d.message), 400);
    try {
      const guarantor = await GuarantorService.inviteGuarantor({
        tenantId: req.user!.id,
        email: value.email,
        role: value.role,
        firstName: value.first_name,
        lastName: value.last_name,
        phone: value.phone,
      });
      return successResponse(res, { guarantor }, 'Invitation envoyée', 201);
    } catch (e) {
      if (e instanceof Error && (e.message === 'DUPLICATE' || e.message === 'ALREADY_LINKED')) {
        return errorResponse(res, 'Garant déjà associé', [], 409);
      }
      return errorResponse(res, 'Erreur invitation garant', [], 400);
    }
  }

  static async uploadDirect(req: Request, res: Response): Promise<Response> {
    const { error, value } = uploadGuarantorDirectSchema.validate(req.body, { abortEarly: false });
    if (error) return errorResponse(res, 'Validation échouée', error.details.map((d) => d.message), 400);
    const guarantor = await GuarantorService.uploadGuarantorDocumentsDirect({
      tenantId: req.user!.id,
      firstName: value.first_name,
      lastName: value.last_name,
      email: value.email,
      phone: value.phone,
      role: value.role,
    });
    return successResponse(
      res,
      { guarantor, folder_id: guarantor.folder_id },
      'Dossier garant créé, vous pouvez uploader ses documents',
      201
    );
  }

  static async acceptInvitation(req: Request, res: Response): Promise<Response> {
    if (!req.user) return errorResponse(res, "Connectez-vous pour accepter l'invitation", [], 401);
    const { error, value } = acceptInvitationSchema.validate(req.body, { abortEarly: false });
    if (error) return errorResponse(res, 'Validation échouée', error.details.map((d) => d.message), 400);
    try {
      const guarantor = await GuarantorService.acceptInvitation(value.token, req.user.id);
      return successResponse(res, { guarantor }, 'Invitation acceptée', 200);
    } catch (e) {
      if (e instanceof Error && e.message === 'EXPIRED') {
        return errorResponse(res, 'Invitation expirée', [], 410);
      }
      return errorResponse(res, 'Invitation invalide', [], 400);
    }
  }

  static async getMyGuarantors(req: Request, res: Response): Promise<Response> {
    const guarantors = await GuarantorService.getGuarantors(req.user!.id);
    return successResponse(res, { guarantors }, 'Garants récupérés', 200);
  }

  static async removeGuarantor(req: Request, res: Response): Promise<Response> {
    try {
      await GuarantorService.removeGuarantor(Number(req.params.guarantorId), req.user!.id);
      return res.status(204).send();
    } catch {
      return errorResponse(res, 'Action non autorisée', [], 403);
    }
  }

  static async getGuarantorFolder(req: Request, res: Response): Promise<Response> {
    try {
      const folder = await GuarantorService.getGuarantorFolder(
        Number(req.params.guarantorId),
        req.user!.id
      );
      return successResponse(res, { folder }, 'Dossier garant récupéré', 200);
    } catch {
      return errorResponse(res, 'Dossier garant introuvable', [], 404);
    }
  }
}
