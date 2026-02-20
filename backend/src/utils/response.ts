import { Response } from 'express';

/**
 * Réponse API standard en cas de succès
 * Format : { success: true, data: ..., message: ..., errors: [] }
 */
export function successResponse(
  res: Response,
  data: unknown,
  message: string,
  statusCode: number = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    errors: [],
  });
}

/**
 * Réponse API standard en cas d'erreur
 * Format : { success: false, data: null, message: ..., errors: [...] }
 */
export function errorResponse(
  res: Response,
  message: string,
  errors: string[] = [],
  statusCode: number = 400
): Response {
  return res.status(statusCode).json({
    success: false,
    data: null,
    message,
    errors,
  });
}
