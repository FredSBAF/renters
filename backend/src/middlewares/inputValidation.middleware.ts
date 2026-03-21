import { NextFunction, Request, Response } from 'express';
import { errorResponse } from '../utils/response';

const hasBadPattern = (value: unknown, patterns: RegExp[]): boolean => {
  if (typeof value === 'string') return patterns.some((p) => p.test(value));
  if (Array.isArray(value)) return value.some((v) => hasBadPattern(v, patterns));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([k, v]) => patterns.some((p) => p.test(k)) || hasBadPattern(v, patterns)
    );
  }
  return false;
};

export const preventNoSQLInjection = (req: Request, res: Response, next: NextFunction): void => {
  const patterns = [/\$where/i, /\$gt/i, /\$lt/i, /\$ne/i, /\$in/i, /\$nin/i, /\$exists/i];
  if (hasBadPattern(req.body, patterns) || hasBadPattern(req.query, patterns) || hasBadPattern(req.params, patterns)) {
    errorResponse(res, 'Requete invalide', [], 400);
    return;
  }
  next();
};

export const preventXSS = (req: Request, res: Response, next: NextFunction): void => {
  const patterns = [/<script/i, /javascript:/i, /onerror=/i, /onload=/i, /eval\(/i];
  if (hasBadPattern(req.body, patterns)) {
    errorResponse(res, 'Contenu non autorise detecte', [], 400);
    return;
  }
  next();
};

export const validateContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (!contentLength) return next();
  const contentType = req.headers['content-type'] ?? '';
  if (String(contentType).includes('multipart/form-data')) return next();
  if (!String(contentType).includes('application/json')) {
    errorResponse(res, 'Unsupported Media Type', [], 415);
    return;
  }
  next();
};
