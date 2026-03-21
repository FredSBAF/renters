import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { GDPRService } from '../services/GDPRService';
import { User, UserConsent } from '../models';
import { errorResponse, successResponse } from '../utils/response';
import { config } from '../config/env';

export class GDPRController {
  static async requestDataExport(req: Request, res: Response): Promise<Response> {
    const zip = await GDPRService.exportUserData(req.user!.id);
    const filename = `mes_donnees_renters_${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(zip);
  }

  static async requestDeletion(req: Request, res: Response): Promise<Response> {
    if (!req.body?.confirm) return errorResponse(res, 'Confirmation requise', [], 400);
    const user = await User.findByPk(req.user!.id);
    if (!user) return errorResponse(res, 'Utilisateur introuvable', [], 404);
    const valid = await bcrypt.compare(String(req.body.password ?? ''), user.password_hash);
    if (!valid) return errorResponse(res, 'Mot de passe invalide', [], 401);
    await GDPRService.requestDeletion(user.id);
    return successResponse(
      res,
      null,
      `Votre compte sera supprime dans ${config.gdpr.accountGraceDays} jours. Un email de confirmation vous a ete envoye.`
    );
  }

  static async cancelDeletion(req: Request, res: Response): Promise<Response> {
    await GDPRService.cancelDeletion(String(req.body?.token ?? ''));
    return successResponse(res, null, 'Suppression annulee, compte reactive');
  }

  static async getConsents(req: Request, res: Response): Promise<Response> {
    const consents = await UserConsent.findAll({ where: { user_id: req.user!.id }, order: [['consented_at', 'DESC']] });
    return successResponse(res, consents, 'Consents fetched');
  }
}
