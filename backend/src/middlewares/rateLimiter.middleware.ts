import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import { errorResponse } from '../utils/response';

const rateLimitHandler =
  (message: string) =>
  (_req: Request, res: Response): Response =>
    errorResponse(res, message, ['RATE_LIMIT_EXCEEDED'], 429);

export const authLimiter = rateLimit({
  windowMs: config.rateLimits.auth.windowMs,
  max: config.rateLimits.auth.max,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email ?? '')}`,
  handler: rateLimitHandler('Trop de tentatives de connexion. Reessayez dans 15 minutes.'),
  skip: () => config.env === 'test',
});

export const registerLimiter = rateLimit({
  windowMs: config.rateLimits.register.windowMs,
  max: config.rateLimits.register.max,
  handler: rateLimitHandler("Trop d'inscriptions depuis cette IP."),
  skip: () => config.env === 'test',
});

export const uploadLimiter = rateLimit({
  windowMs: config.rateLimits.upload.windowMs,
  max: config.rateLimits.upload.max,
  keyGenerator: (req) => `upload:${req.user?.id || req.ip}`,
  handler: rateLimitHandler("Limite d'uploads atteinte. Reessayez dans 1 heure."),
  skip: () => config.env === 'test',
});

export const sharingLimiter = rateLimit({
  windowMs: config.rateLimits.sharing.windowMs,
  max: config.rateLimits.sharing.max,
  keyGenerator: (req) => `sharing:${req.user?.id || req.ip}`,
  handler: rateLimitHandler('Trop de liens crees. Reessayez dans 1 heure.'),
  skip: () => config.env === 'test',
});

export const exportLimiter = rateLimit({
  windowMs: config.rateLimits.export.windowMs,
  max: config.rateLimits.export.max,
  keyGenerator: (req) => `export:${req.user?.id || req.ip}`,
  handler: rateLimitHandler("Limite d'exports atteinte. Reessayez dans 24 heures."),
  skip: () => config.env === 'test',
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: config.rateLimits.forgotPassword.windowMs,
  max: config.rateLimits.forgotPassword.max,
  keyGenerator: (req) => `${req.ip}:forgot`,
  handler: rateLimitHandler('Trop de demandes de reinitialisation. Reessayez dans 1 heure.'),
  skip: () => config.env === 'test',
});

export const agencyApiLimiter = rateLimit({
  windowMs: config.rateLimits.agencyApi.windowMs,
  max: config.rateLimits.agencyApi.max,
  keyGenerator: (req) => `agency:${req.user?.agencyId || req.ip}`,
  handler: rateLimitHandler('Trop de requetes. Ralentissez.'),
  skip: () => config.env === 'test',
});
