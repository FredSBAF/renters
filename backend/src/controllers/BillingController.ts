import { Request, Response } from 'express';
import { Agency, PaymentLog, User } from '../models';
import { StripeService } from '../services/StripeService';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';

export class BillingController {
  private static buildPaymentLogsWhere(req: Request): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (req.query.agency_id) {
      where.agency_id = Number(req.query.agency_id);
    }
    if (req.query.event_type) {
      where.event_type = String(req.query.event_type);
    }
    if (req.query.status) {
      where.status = String(req.query.status);
    }
    return where;
  }

  private static toCsvValue(value: unknown): string {
    const str = value === null || value === undefined ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  }

  static async createCheckoutSession(req: Request, res: Response): Promise<Response> {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return errorResponse(res, 'Aucune agence associée à cet utilisateur', [], 400);
    }

    const agency = await Agency.findByPk(agencyId);
    if (!agency) {
      return errorResponse(res, 'Agence introuvable', [], 404);
    }
    if (agency.status === 'active') {
      return errorResponse(res, 'L’agence dispose déjà d’un abonnement actif', [], 400);
    }

    const owner = await User.findOne({
      where: { agency_id: agency.id, role: 'agency_owner' },
    });
    if (!owner) {
      return errorResponse(res, 'Owner d’agence introuvable', [], 404);
    }

    try {
      const checkoutUrl = await StripeService.createCheckoutSession(agency.id, owner.email);
      return successResponse(res, { checkout_url: checkoutUrl }, 'Session Stripe créée', 200);
    } catch (error) {
      logger.error(
        `Billing checkout error: ${error instanceof Error ? error.message : 'unknown'}`
      );
      return errorResponse(res, 'Impossible de créer la session Stripe', [], 500);
    }
  }

  static async createPortalSession(req: Request, res: Response): Promise<Response> {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return errorResponse(res, 'Aucune agence associée à cet utilisateur', [], 400);
    }

    const agency = await Agency.findByPk(agencyId);
    if (!agency) {
      return errorResponse(res, 'Agence introuvable', [], 404);
    }
    if (!agency.customer_id) {
      return errorResponse(res, 'Aucun abonnement trouvé', [], 400);
    }

    try {
      const portalUrl = await StripeService.createBillingPortalSession(agency.customer_id);
      return successResponse(res, { portal_url: portalUrl }, 'Portail de facturation créé', 200);
    } catch (error) {
      logger.error(`Billing portal error: ${error instanceof Error ? error.message : 'unknown'}`);
      return errorResponse(res, 'Impossible de créer le portail Stripe', [], 500);
    }
  }

  static async getBillingStatus(req: Request, res: Response): Promise<Response> {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return errorResponse(res, 'Aucune agence associée à cet utilisateur', [], 400);
    }
    const agency = await Agency.findByPk(agencyId);
    if (!agency) {
      return errorResponse(res, 'Agence introuvable', [], 404);
    }

    const data = {
      status: agency.status,
      trial_ends_at: agency.trial_ends_at,
      next_billing_date: agency.next_billing_date,
      subscription_id: req.user?.role === 'agency_owner' ? agency.subscription_id : null,
    };

    return successResponse(res, data, 'Statut de facturation récupéré', 200);
  }

  static async handleStripeWebhook(req: Request, res: Response): Promise<Response> {
    const signature = req.headers['stripe-signature'];
    if (!signature || Array.isArray(signature)) {
      return errorResponse(res, 'Signature Stripe manquante', [], 400);
    }

    try {
      await StripeService.handleWebhook(req.body as Buffer, signature);
      return successResponse(res, { received: true }, 'Webhook Stripe reçu', 200);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_SIGNATURE') {
        return errorResponse(res, 'Signature Stripe invalide', [], 400);
      }
      logger.error(
        `Stripe webhook processing error: ${error instanceof Error ? error.message : 'unknown'}`
      );
      return successResponse(res, { received: true }, 'Webhook Stripe reçu', 200);
    }
  }

  static async getPaymentLogs(req: Request, res: Response): Promise<Response> {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const offset = (page - 1) * limit;

    const where = BillingController.buildPaymentLogsWhere(req);

    try {
      const { rows, count } = await PaymentLog.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset,
      });

      return successResponse(
        res,
        {
          items: rows,
          pagination: {
            page,
            limit,
            total: count,
            total_pages: Math.ceil(count / limit),
          },
        },
        'Logs de paiement récupérés',
        200
      );
    } catch (error) {
      logger.error(`Billing logs error: ${error instanceof Error ? error.message : 'unknown'}`);
      return errorResponse(res, 'Impossible de récupérer les logs de paiement', [], 500);
    }
  }

  static async exportPaymentLogsCsv(req: Request, res: Response): Promise<Response | void> {
    const where = BillingController.buildPaymentLogsWhere(req);
    try {
      const rows = await PaymentLog.findAll({
        where,
        order: [['created_at', 'DESC']],
      });

      const headers = [
        'id',
        'agency_id',
        'stripe_event_id',
        'event_type',
        'amount',
        'currency',
        'status',
        'created_at',
      ];

      const lines = rows.map((row) => {
        const payload = row.toJSON() as Record<string, unknown>;
        return [
          BillingController.toCsvValue(payload.id),
          BillingController.toCsvValue(payload.agency_id),
          BillingController.toCsvValue(payload.stripe_event_id),
          BillingController.toCsvValue(payload.event_type),
          BillingController.toCsvValue(payload.amount),
          BillingController.toCsvValue(payload.currency),
          BillingController.toCsvValue(payload.status),
          BillingController.toCsvValue(payload.created_at),
        ].join(',');
      });

      const csv = [headers.join(','), ...lines].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="payment_logs.csv"');
      return res.status(200).send(csv);
    } catch (error) {
      logger.error(
        `Billing logs export error: ${error instanceof Error ? error.message : 'unknown'}`
      );
      return errorResponse(res, 'Impossible d’exporter les logs de paiement', [], 500);
    }
  }
}
