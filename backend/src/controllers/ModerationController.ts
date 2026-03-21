import { Request, Response } from 'express';
import { AIService } from '../services/AIService';
import { ModerationService } from '../services/ModerationService';
import { errorResponse, successResponse } from '../utils/response';
import {
  getModerationQueueSchema,
  requestMoreInfoSchema,
  resolveItemSchema,
} from '../validators/moderation.validator';

export class ModerationController {
  static async getQueue(req: Request, res: Response): Promise<Response> {
    const { error, value } = getModerationQueueSchema.validate(req.query, { abortEarly: false });
    if (error) {
      return errorResponse(res, 'Validation échouée', error.details.map((d) => d.message), 400);
    }
    const result = await ModerationService.getQueue({
      status: value.status,
      priority: value.priority,
      page: value.page,
      limit: value.limit,
    });
    const slaStats = await ModerationService.getSLAStats();
    return successResponse(res, { items: result.items, total: result.total, sla_stats: slaStats }, 'Queue de modération', 200);
  }

  static async assignItem(req: Request, res: Response): Promise<Response> {
    try {
      const item = await ModerationService.assignToAdmin(Number(req.params.queueId), req.user!.id);
      return successResponse(res, { item }, 'Item assigné', 200);
    } catch {
      return errorResponse(res, 'Impossible d’assigner cet item', [], 400);
    }
  }

  static async resolveItem(req: Request, res: Response): Promise<Response> {
    const { error, value } = resolveItemSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(res, 'Validation échouée', error.details.map((d) => d.message), 400);
    }
    try {
      const item = await ModerationService.resolveItem({
        queueId: Number(req.params.queueId),
        adminUserId: req.user!.id,
        resolution: value.resolution,
        adminNotes: value.admin_notes,
        adjustedScore: value.adjusted_score,
      });
      return successResponse(res, { item }, 'Item résolu', 200);
    } catch {
      return errorResponse(res, 'Impossible de résoudre cet item', [], 400);
    }
  }

  static async requestMoreInfo(req: Request, res: Response): Promise<Response> {
    const { error, value } = requestMoreInfoSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(res, 'Validation échouée', error.details.map((d) => d.message), 400);
    }
    try {
      await ModerationService.requestMoreInfo({
        queueId: Number(req.params.queueId),
        adminUserId: req.user!.id,
        message: value.message,
      });
      return successResponse(res, null, 'Demande envoyée', 200);
    } catch {
      return errorResponse(res, 'Impossible de demander des informations', [], 400);
    }
  }

  static async triggerAnalysis(req: Request, res: Response): Promise<Response> {
    await AIService.triggerAnalysis(Number(req.params.folderId));
    return successResponse(res, null, 'Analyse lancée', 200);
  }
}
