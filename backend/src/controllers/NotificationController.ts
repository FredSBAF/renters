import { Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { getNotificationsSchema, updatePreferencesSchema } from '../validators/notification.validator';
import { errorResponse, successResponse } from '../utils/response';

export class NotificationController {
  static async getNotifications(req: Request, res: Response): Promise<Response> {
    const { value, error } = getNotificationsSchema.validate(req.query);
    if (error) return errorResponse(res, error.details[0].message, [], 400);
    const data = await NotificationService.getNotifications(req.user!.id, value);
    return successResponse(res, { ...data, page: value.page, limit: value.limit }, 'Notifications fetched');
  }

  static async getUnreadCount(req: Request, res: Response): Promise<Response> {
    const unread_count = await NotificationService.getUnreadCount(req.user!.id);
    return successResponse(res, { unread_count }, 'Unread count fetched');
  }

  static async markAsRead(req: Request, res: Response): Promise<Response> {
    try {
      await NotificationService.markAsRead(Number(req.params.id), req.user!.id);
      return successResponse(res, null, 'Notification marked as read');
    } catch {
      return errorResponse(res, 'NOTIFICATION_NOT_FOUND', [], 404);
    }
  }

  static async markAllAsRead(req: Request, res: Response): Promise<Response> {
    await NotificationService.markAllAsRead(req.user!.id);
    return successResponse(res, null, 'Toutes les notifications marquees comme lues');
  }

  static async deleteNotification(req: Request, res: Response): Promise<Response> {
    try {
      await NotificationService.deleteNotification(Number(req.params.id), req.user!.id);
      return res.status(204).send();
    } catch {
      return errorResponse(res, 'NOTIFICATION_NOT_FOUND', [], 404);
    }
  }

  static async getPreferences(req: Request, res: Response): Promise<Response> {
    const preferences = await NotificationService.getOrCreatePreferences(req.user!.id);
    return successResponse(res, preferences, 'Preferences fetched');
  }

  static async updatePreferences(req: Request, res: Response): Promise<Response> {
    const { value, error } = updatePreferencesSchema.validate(req.body);
    if (error) return errorResponse(res, error.details[0].message, [], 400);
    const preferences = await NotificationService.updatePreferences(req.user!.id, value);
    return successResponse(res, preferences, 'Preferences updated');
  }
}
