import { Request, Response } from 'express';
import { AgencyService } from '../services/AgencyService';
import { errorResponse, successResponse } from '../utils/response';
import {
  inviteAgentSchema,
  joinAgencySchema,
  registerAgencySchema,
} from '../validators/agency.validator';
import { logger } from '../utils/logger';

export class AgencyController {
  static async register(req: Request, res: Response): Promise<Response> {
    const { error, value } = registerAgencySchema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        'Validation échouée',
        error.details.map((d) => d.message),
        400
      );
    }

    try {
      const result = await AgencyService.registerAgency(
        value,
        req.ip,
        req.headers['user-agent']
      );
      return successResponse(
        res,
        {
          agency: result.agency,
          owner: {
            id: result.owner.id,
            email: result.owner.email,
            role: result.owner.role,
          },
        },
        'Email de confirmation envoyé',
        201
      );
    } catch (err) {
      if (err instanceof Error && err.message === 'DUPLICATE_SIRET') {
        return errorResponse(res, 'Une agence existe déjà avec ce SIRET', [], 409);
      }
      if (err instanceof Error && err.message === 'DUPLICATE_EMAIL') {
        return errorResponse(res, 'Un compte existe déjà avec cette adresse email', [], 409);
      }
      logger.error(
        `Agency register error: ${err instanceof Error ? err.message : 'unknown error'}`
      );
      return errorResponse(res, 'Erreur interne serveur', [], 500);
    }
  }

  static async inviteAgent(req: Request, res: Response): Promise<Response> {
    const { error, value } = inviteAgentSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        'Validation échouée',
        error.details.map((d) => d.message),
        400
      );
    }

    try {
      await AgencyService.inviteAgent(req.user!.agencyId!, value.email, req.user!.id);
      return successResponse(res, null, 'Invitation envoyée', 200);
    } catch (err) {
      if (err instanceof Error && err.message === 'AGENCY_NOT_ACTIVE') {
        return errorResponse(res, 'Agence introuvable ou inactive', [], 403);
      }
      if (err instanceof Error && err.message === 'EMAIL_ALREADY_USED') {
        return errorResponse(res, 'Cet email est déjà utilisé', [], 409);
      }
      if (err instanceof Error && err.message === 'ALREADY_IN_AGENCY') {
        return errorResponse(res, 'Cet utilisateur est déjà membre de l’agence', [], 409);
      }
      logger.error(
        `Agency invite error: ${err instanceof Error ? err.message : 'unknown error'}`
      );
      return errorResponse(res, 'Erreur interne serveur', [], 500);
    }
  }

  static async removeAgent(req: Request, res: Response): Promise<Response> {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return errorResponse(res, 'Identifiant utilisateur invalide', [], 400);
    }

    try {
      await AgencyService.removeAgent(req.user!.agencyId!, userId, req.user!.id);
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'FORBIDDEN') {
        return errorResponse(res, 'Action non autorisée', [], 403);
      }
      if (err instanceof Error && err.message === 'CANNOT_REMOVE_SELF') {
        return errorResponse(res, 'Vous ne pouvez pas vous retirer vous-même', [], 400);
      }
      if (err instanceof Error && err.message === 'AGENT_NOT_FOUND') {
        return errorResponse(res, 'Agent introuvable pour cette agence', [], 404);
      }
      logger.error(
        `Agency remove error: ${err instanceof Error ? err.message : 'unknown error'}`
      );
      return errorResponse(res, 'Erreur interne serveur', [], 500);
    }
  }

  static async getTeam(req: Request, res: Response): Promise<Response> {
    try {
      const team = await AgencyService.getAgencyTeam(req.user!.agencyId!);
      return successResponse(res, { members: team }, 'Équipe récupérée', 200);
    } catch (err) {
      logger.error(`Agency team error: ${err instanceof Error ? err.message : 'unknown error'}`);
      return errorResponse(res, 'Erreur interne serveur', [], 500);
    }
  }

  static async joinByToken(req: Request, res: Response): Promise<Response> {
    const { error, value } = joinAgencySchema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        'Validation échouée',
        error.details.map((d) => d.message),
        400
      );
    }

    try {
      const user = await AgencyService.joinAgencyByToken(value.token);
      return successResponse(res, { user }, 'Agence rejointe avec succès', 200);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_TOKEN') {
        return errorResponse(res, 'Lien invalide ou expiré', [], 400);
      }
      if (err instanceof Error && err.message === 'AGENCY_NOT_FOUND') {
        return errorResponse(res, 'Agence introuvable', [], 404);
      }
      logger.error(`Agency join error: ${err instanceof Error ? err.message : 'unknown error'}`);
      return errorResponse(res, 'Erreur interne serveur', [], 500);
    }
  }

  static async getMyAgency(req: Request, res: Response): Promise<Response> {
    try {
      const agency = await AgencyService.getAgencyById(req.user!.agencyId!);
      return successResponse(res, { agency }, 'Agence récupérée', 200);
    } catch (err) {
      if (err instanceof Error && err.message === 'AGENCY_NOT_FOUND') {
        return errorResponse(res, 'Agence introuvable', [], 404);
      }
      logger.error(`Agency get error: ${err instanceof Error ? err.message : 'unknown error'}`);
      return errorResponse(res, 'Erreur interne serveur', [], 500);
    }
  }
}
