import { NextFunction, Request, Response } from 'express';
import { AuditLog } from '../models';
import { logger } from '../utils/logger';

const AUDIT_ROUTES: Record<string, string> = {
  'POST /api/v1/auth/login': 'auth.login',
  'POST /api/v1/auth/logout': 'auth.logout',
  'POST /api/v1/auth/forgot-password': 'auth.password_reset_requested',
  'POST /api/v1/users/me/delete-account': 'gdpr.deletion_requested',
  'GET /api/v1/users/me/data-export': 'gdpr.data_exported.self',
  'POST /api/v1/users/me/enable-2fa': 'auth.2fa_enabled',
  'DELETE /api/v1/documents/:id': 'document.deleted',
  'DELETE /api/v1/sharing/links/:linkId': 'sharing_link.revoked',
  'POST /api/v1/admin/users/:userId/suspend': 'admin.user.suspended',
  'DELETE /api/v1/admin/users/:userId': 'admin.user.deleted',
};

export const autoAuditLog = (req: Request, res: Response, next: NextFunction): void => {
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const key = `${req.method} ${req.baseUrl}${req.route?.path ?? ''}`;
    const action = AUDIT_ROUTES[key];
    if (!action) return;
    void Promise.resolve(
      AuditLog.create({
      user_id: req.user?.id ?? null,
      agency_id: req.user?.agencyId ?? null,
      ip_address: req.ip,
      action,
      entity_type: req.baseUrl.split('/').pop() ?? null,
      entity_id: req.params.id ? Number(req.params.id) : req.params.userId ? Number(req.params.userId) : null,
      details: { method: req.method, path: req.path, request_id: req.requestId } as unknown as object,
      })
    ).catch((err) => logger.error('autoAuditLog failed', err));
  });
  next();
};
