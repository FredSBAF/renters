import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { errorResponse } from '../utils/response';
import { User } from '../models';

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [k, ...rest] = part.trim().split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const cookies = parseCookieHeader(req.headers.cookie);
  const token =
    cookies.access_token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
  if (!token) {
    errorResponse(res, 'Non authentifié', [], 401);
    return;
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as unknown as {
      sub: number;
      email: string;
      role: string;
    };
    const user = await User.findByPk(decoded.sub);
    if (!user) {
      errorResponse(res, 'Utilisateur introuvable', [], 401);
      return;
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agency_id,
      is_2fa_enabled: user.is_2fa_enabled,
      status: user.status,
    };
    next();
  } catch {
    errorResponse(res, 'Token invalide ou expiré', [], 401);
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  let authNextCalled = false;
  await authMiddleware(req, res, () => {
    authNextCalled = true;
  });
  if (!authNextCalled || !req.user) return;
  if (req.user.status !== 'active') {
    errorResponse(res, 'Compte non activé ou suspendu', [], 401);
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(res, 'Non authentifié', [], 401);
      return;
    }
    if (!roles.includes(req.user.role)) {
      errorResponse(res, 'Action non autorisée', [], 403);
      return;
    }
    next();
  };
}

export function requireAgency2FA(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    errorResponse(res, 'Non authentifié', [], 401);
    return;
  }
  const isAgencyRole = req.user.role === 'agency_owner' || req.user.role === 'agency_agent';
  if (isAgencyRole && req.user.is_2fa_enabled === false) {
    errorResponse(
      res,
      '2FA obligatoire pour les comptes agences. Activez-le dans /settings/security',
      [],
      403
    );
    return;
  }
  next();
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as unknown as {
      sub: number;
      email: string;
      role: string;
    };
    const user = await User.findByPk(decoded.sub);
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        agencyId: user.agency_id,
        is_2fa_enabled: user.is_2fa_enabled,
        status: user.status,
      };
    }
  } catch {
    // Intentionally ignore invalid tokens for optional auth.
  }
  next();
}
