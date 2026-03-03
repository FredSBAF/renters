import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { errorResponse } from '../utils/response';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
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
    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
    next();
  } catch {
    errorResponse(res, 'Token invalide ou expiré', [], 401);
  }
}
