import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Agency } from '../models';
import { errorResponse } from '../utils/response';

export const suspendedAccountCheck = (req: Request, res: Response, next: NextFunction): void => {
  const status = req.user?.status;
  if (status === 'suspended') {
    errorResponse(res, 'Votre compte a ete suspendu. Contactez support@renters.app', [], 403);
    return;
  }
  if (status === 'deleted') {
    errorResponse(res, "Ce compte n'existe plus.", [], 401);
    return;
  }
  next();
};

export const agencySubscriptionCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || !['agency_owner', 'agency_agent'].includes(req.user.role)) {
    next();
    return;
  }
  const agency = req.user.agencyId ? await Agency.findByPk(req.user.agencyId) : null;
  if (!agency) return next();
  if (agency.status === 'suspended') return void errorResponse(res, 'Abonnement suspendu. Mettez a jour vos informations de paiement.', [], 402);
  if (agency.status === 'cancelled') return void errorResponse(res, 'Abonnement resilie. Souscrivez un nouvel abonnement.', [], 402);
  if (agency.status === 'trial' && agency.trial_ends_at && new Date(agency.trial_ends_at) < new Date()) {
    return void errorResponse(res, "Periode d'essai expiree. Souscrivez un abonnement.", [], 402);
  }
  next();
};

const sanitize = (obj: unknown): unknown => {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (['password', 'password_confirmation'].includes(k)) out[k] = v;
      else out[k] = sanitize(v);
    }
    return out;
  }
  if (typeof obj === 'string') return obj.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return obj;
};

export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  req.body = sanitize(req.body);
  next();
};

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};
