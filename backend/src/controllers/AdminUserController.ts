import { Request, Response } from 'express';
import { AdminUserService } from '../services/AdminUserService';
import { deleteUserSchema, getUsersQuerySchema, suspendUserSchema } from '../validators/admin.validator';
import { errorResponse, successResponse } from '../utils/response';
import { AuditLog } from '../models';
import { logger } from '../utils/logger';

export class AdminUserController {
  static async getUsers(req: Request, res: Response): Promise<Response> {
    const { value, error } = getUsersQuerySchema.validate(req.query);
    if (error) return errorResponse(res, error.details[0].message, [], 400);
    const result = await AdminUserService.searchUsers(value);
    return successResponse(res, result, 'Users fetched');
  }

  static async getUserDetails(req: Request, res: Response): Promise<Response> {
    try {
      const details = await AdminUserService.getUserDetails(Number(req.params.userId));
      return successResponse(res, details, 'User details fetched');
    } catch {
      return errorResponse(res, 'USER_NOT_FOUND', [], 404);
    }
  }

  static async suspendUser(req: Request, res: Response): Promise<Response> {
    try {
      const { value, error } = suspendUserSchema.validate(req.body);
      if (error) return errorResponse(res, error.details[0].message, [], 400);
      await AdminUserService.suspendUser(Number(req.params.userId), req.user!.id, value.reason);
      return successResponse(res, { message: 'Utilisateur suspendu' }, 'User suspended');
    } catch (e) {
      return AdminUserController.handleError(res, e);
    }
  }

  static async reactivateUser(req: Request, res: Response): Promise<Response> {
    try {
      await AdminUserService.reactivateUser(Number(req.params.userId), req.user!.id);
      return successResponse(res, { message: 'Utilisateur reactife' }, 'User reactivated');
    } catch (e) {
      return AdminUserController.handleError(res, e);
    }
  }

  static async deleteUser(req: Request, res: Response): Promise<Response> {
    const { error } = deleteUserSchema.validate(req.body);
    if (error) return errorResponse(res, error.details[0].message, [], 400);
    try {
      await AdminUserService.deleteUser(Number(req.params.userId), req.user!.id);
      return res.status(204).send();
    } catch (e) {
      return AdminUserController.handleError(res, e);
    }
  }

  static async exportUserData(req: Request, res: Response): Promise<Response> {
    try {
      const userId = Number(req.params.userId);
      const zip = await AdminUserService.exportUserData(userId);
      await AuditLog.create({
        user_id: req.user?.id,
        action: 'admin.user.data_exported',
        details: { user_id: userId } as unknown as object,
      });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="user_${userId}_data.zip"`);
      return res.status(200).send(zip);
    } catch (e) {
      logger.error('AdminUserController.exportUserData failed', e);
      return errorResponse(res, 'USER_EXPORT_ERROR', [], 500);
    }
  }

  static async changeRole(req: Request, res: Response): Promise<Response> {
    try {
      await AdminUserService.changeUserRole(Number(req.params.userId), req.body.role, req.user!.id);
      return successResponse(res, { message: 'Role modifie' }, 'User role changed');
    } catch (e) {
      return AdminUserController.handleError(res, e);
    }
  }

  static async getAuditLogs(req: Request, res: Response): Promise<Response> {
    const value = {
      userId: req.query.userId ? Number(req.query.userId) : undefined,
      agencyId: req.query.agencyId ? Number(req.query.agencyId) : undefined,
      action: req.query.action as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    };
    const result = await AdminUserService.getAuditLogs(value);
    return successResponse(res, result, 'Audit logs fetched');
  }

  private static handleError(res: Response, e: unknown): Response {
    if (e instanceof Error) {
      if (e.message === 'NOT_FOUND') return errorResponse(res, 'USER_NOT_FOUND', [], 404);
      if (e.message === 'SELF') return errorResponse(res, 'ACTION_NOT_ALLOWED', [], 400);
      if (e.message === 'FORBIDDEN') return errorResponse(res, 'ACTION_FORBIDDEN', [], 403);
    }
    return errorResponse(res, 'ADMIN_USER_ACTION_ERROR', [], 500);
  }
}
