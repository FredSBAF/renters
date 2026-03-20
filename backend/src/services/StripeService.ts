import Stripe from 'stripe';
import { config } from '../config/env';
import { Agency, PaymentLog, User } from '../models';
import {
  sendPaymentFailed,
  sendSubscriptionCancelled,
  sendSubscriptionConfirmation,
} from './EmailService';
import { logger } from '../utils/logger';

const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' as never });

export class StripeService {
  static async createCheckoutSession(
    agencyId: number,
    agencyEmail: string
  ): Promise<string> {
    const agency = await Agency.findByPk(agencyId);
    if (!agency) {
      throw new Error('AGENCY_NOT_FOUND');
    }

    let customerId = agency.customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: agencyEmail,
        metadata: { agency_id: agencyId.toString() },
      });
      customerId = customer.id;
      await agency.update({ customer_id: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: config.stripe.priceId, quantity: 1 }],
      success_url: `${config.stripe.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: config.stripe.cancelUrl,
      metadata: { agency_id: agencyId.toString() },
      subscription_data: {
        metadata: { agency_id: agencyId.toString() },
      },
      billing_address_collection: 'required',
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new Error('CHECKOUT_URL_MISSING');
    }
    return session.url;
  }

  static async createBillingPortalSession(customerId: string): Promise<string> {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: config.stripe.successUrl,
    });
    return session.url;
  }

  static async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
    } catch (error) {
      logger.error(
        `Stripe signature verification failed: ${error instanceof Error ? error.message : 'unknown'}`
      );
      throw new Error('INVALID_SIGNATURE');
    }

    logger.info(`Stripe webhook received: ${event.type} (${event.id})`);

    const alreadyHandled = await PaymentLog.findOne({
      where: { stripe_event_id: event.id },
    });
    if (alreadyHandled) {
      logger.info(`Stripe event ignored (idempotent): ${event.id}`);
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const agencyId = Number(session.metadata?.agency_id);
        if (!agencyId) {
          logger.warn(`checkout.session.completed missing agency_id: ${event.id}`);
          return;
        }

        const agency = await Agency.findByPk(agencyId);
        if (!agency) {
          logger.warn(`Agency not found for checkout.session.completed: ${agencyId}`);
          return;
        }

        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        await agency.update({
          status: 'active',
          subscription_id:
            typeof session.subscription === 'string' ? session.subscription : null,
          next_billing_date: nextBilling.toISOString().slice(0, 10),
        });

        await PaymentLog.create({
          agency_id: agencyId,
          stripe_event_id: event.id,
          event_type: event.type,
          status: 'success',
          stripe_payload: event.data.object as object,
        });

        const owner = await User.findOne({
          where: { agency_id: agencyId, role: 'agency_owner' },
        });
        if (owner) {
          await sendSubscriptionConfirmation(owner.email);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceObj = event.data.object as unknown as Record<string, unknown>;
        const parentObj = (invoiceObj.parent ?? {}) as {
          subscription_details?: { subscription?: string };
        };
        const subscriptionId =
          typeof invoiceObj.subscription === 'string'
            ? invoiceObj.subscription
            : parentObj.subscription_details?.subscription ?? null;
        if (!subscriptionId) return;

        const agency = await Agency.findOne({
          where: { subscription_id: subscriptionId },
        });
        if (!agency) return;

        const periodEndUnix =
          invoice.lines.data[0]?.period?.end ?? Math.floor(Date.now() / 1000);
        await agency.update({
          next_billing_date: new Date(periodEndUnix * 1000).toISOString().slice(0, 10),
        });

        await PaymentLog.create({
          agency_id: agency.id,
          stripe_event_id: event.id,
          event_type: event.type,
          amount: invoice.amount_paid,
          currency: invoice.currency ?? 'eur',
          status: 'success',
          stripe_payload: event.data.object as object,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceObj = event.data.object as unknown as Record<string, unknown>;
        const parentObj = (invoiceObj.parent ?? {}) as {
          subscription_details?: { subscription?: string };
        };
        const subscriptionId =
          typeof invoiceObj.subscription === 'string'
            ? invoiceObj.subscription
            : parentObj.subscription_details?.subscription ?? null;
        if (!subscriptionId) return;

        const agency = await Agency.findOne({
          where: { subscription_id: subscriptionId },
        });
        if (!agency) return;

        await PaymentLog.create({
          agency_id: agency.id,
          stripe_event_id: event.id,
          event_type: event.type,
          amount: invoice.amount_due,
          currency: invoice.currency ?? 'eur',
          status: 'failed',
          stripe_payload: event.data.object as object,
        });

        if ((invoice.attempt_count ?? 0) >= 3) {
          await agency.update({ status: 'suspended' });
        }

        const owner = await User.findOne({
          where: { agency_id: agency.id, role: 'agency_owner' },
        });
        if (owner) {
          await sendPaymentFailed(owner.email, invoice.attempt_count ?? 1);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const agency = await Agency.findOne({
          where: { subscription_id: subscription.id },
        });
        if (!agency) return;

        await agency.update({
          status: 'cancelled',
          subscription_id: null,
        });

        await PaymentLog.create({
          agency_id: agency.id,
          stripe_event_id: event.id,
          event_type: event.type,
          status: 'success',
          stripe_payload: event.data.object as object,
        });

        const owner = await User.findOne({
          where: { agency_id: agency.id, role: 'agency_owner' },
        });
        if (owner) {
          await sendSubscriptionCancelled(owner.email);
        }
        break;
      }

      default:
        logger.info(`Stripe webhook event ignoré: ${event.type}`);
        await PaymentLog.create({
          agency_id: null,
          stripe_event_id: event.id,
          event_type: event.type,
          status: 'pending',
          stripe_payload: event.data.object as object,
        });
    }
  }
}
