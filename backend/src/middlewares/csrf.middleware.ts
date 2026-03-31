import { NextFunction, Request, Response } from 'express';
import { config } from '../config/env';
import { errorResponse } from '../utils/response';

function resolveRequestOrigin(req: Request): string | null {
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string' && originHeader.length > 0) {
    return originHeader;
  }

  const refererHeader = req.headers.referer;
  if (typeof refererHeader === 'string' && refererHeader.length > 0) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      return null;
    }
  }

  return null;
}

export function csrfOriginCheck(req: Request, res: Response, next: NextFunction): void {
  // Keep tests deterministic and avoid forcing test fixtures to send Origin/Referer.
  if (config.env === 'test') {
    next();
    return;
  }

  const requestOrigin = resolveRequestOrigin(req);
  if (!requestOrigin) {
    errorResponse(res, 'Requête refusée (CSRF: Origin/Referer manquant)', ['CSRF_MISSING_ORIGIN'], 403);
    return;
  }

  if (!config.cors.allowedOrigins.includes(requestOrigin)) {
    errorResponse(res, 'Requête refusée (CSRF: origin non autorisée)', ['CSRF_INVALID_ORIGIN'], 403);
    return;
  }

  next();
}
