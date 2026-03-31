import { Request, Response } from 'express';
import { AuditLog, User } from '../models';
import { errorResponse, successResponse } from '../utils/response';
import {
  generatePresentationSchema,
  updateSearchCriteriaSchema,
} from '../validators/searchCriteria.validators';
import * as searchCriteriaService from '../services/searchCriteria.service';
import { SearchCriteriaAiError } from '../services/searchCriteria.service';
import { logger } from '../utils/logger';

export const getSearchCriteria = async (req: Request, res: Response): Promise<void> => {
  try {
    const criteria = await searchCriteriaService.getByUserId(req.user!.id);
    if (!criteria) {
      errorResponse(res, 'Aucun critère de recherche trouvé', [], 404);
      return;
    }
    successResponse(res, criteria.toJSON(), 'Critères de recherche récupérés');
  } catch (error) {
    errorResponse(res, 'Erreur récupération critères de recherche', ['INTERNAL_ERROR'], 500);
  }
};

export const updateSearchCriteria = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = updateSearchCriteriaSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((d) => d.message);
    errorResponse(res, 'Données invalides', errors, 400);
    return;
  }

  try {
    const existing = await searchCriteriaService.getByUserId(req.user!.id);
    const criteria = await searchCriteriaService.upsert(req.user!.id, value);

    await AuditLog.create({
      user_id: req.user!.id,
      action: 'search_criteria.updated',
      entity_type: 'search_criteria',
      entity_id: criteria.id,
      details: {
        cities_count: value.cities.length,
        property_types: value.property_types,
        budget_ideal: value.budget_ideal,
        budget_max: value.budget_max,
      } as unknown as object,
    });

    successResponse(
      res,
      criteria.toJSON(),
      'Critères de recherche mis à jour',
      existing ? 200 : 201
    );
  } catch {
    errorResponse(res, 'Erreur mise à jour des critères de recherche', ['INTERNAL_ERROR'], 500);
  }
};

export const generatePresentation = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = generatePresentationSchema.validate(req.body);
  if (error) {
    errorResponse(res, 'Données invalides', [error.message], 400);
    return;
  }

  try {
    const user = await User.findByPk(req.user!.id);
    if (user && user.ai_generation_count >= 5) {
      const resetAt = user.ai_generation_reset_at;
      if (resetAt && new Date() < resetAt) {
        errorResponse(
          res,
          'Limite de génération atteinte. Réessayez dans une heure.',
          ['RATE_LIMIT_AI'],
          429
        );
        return;
      }
      await user.update({
        ai_generation_count: 0,
        ai_generation_reset_at: new Date(Date.now() + 3600000),
      });
    }

    const text = await searchCriteriaService.generatePresentation(value);

    await user?.increment('ai_generation_count');
    if (!user?.ai_generation_reset_at || new Date() > user.ai_generation_reset_at) {
      await user?.update({
        ai_generation_reset_at: new Date(Date.now() + 3600000),
      });
    }

    await AuditLog.create({
      user_id: req.user!.id,
      action: 'search_criteria.ai_presentation_generated',
      entity_type: 'search_criteria',
      details: {
        tenant_profile: value.tenant_profile,
        cities: value.cities,
      } as unknown as object,
    });

    successResponse(res, { text }, 'Texte généré avec succès');
  } catch (error) {
    if (error instanceof SearchCriteriaAiError) {
      errorResponse(res, error.userMessage, [error.code], error.statusCode);
      return;
    }
    const err = error as { message?: string };
    logger.error(
      `[searchCriteria.generatePresentation] Unexpected error message="${err?.message ?? 'n/a'}"`
    );
    errorResponse(res, 'Erreur génération de texte', ['INTERNAL_ERROR'], 500);
  }
};
