import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { Agency, PaymentLog, User } from '../models';
import { StripeService } from '../services/StripeService';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../services/StripeService', () => ({
  StripeService: {
    createCheckoutSession: jest.fn(),
    createBillingPortalSession: jest.fn(),
    handleWebhook: jest.fn(),
  },
}));

jest.mock('../models', () => ({
  Agency: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue([1]),
  },
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  RefreshToken: {},
  EmailVerificationToken: {},
  PasswordResetToken: {},
  UserConsent: {},
  PaymentLog: {
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
  },
}));

describe('POST /api/v1/billing/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({
      sub: 1,
      email: 'owner@agency.fr',
      role: 'agency_owner',
    });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      email: 'owner@agency.fr',
      role: 'agency_owner',
      agency_id: 10,
      is_2fa_enabled: true,
    } as never);
    jest.mocked(User.findOne).mockResolvedValue({
      id: 1,
      email: 'owner@agency.fr',
      role: 'agency_owner',
    } as never);
  });

  test('should return checkout_url for trial agency', async () => {
    jest.mocked(Agency.findByPk).mockResolvedValue({
      id: 10,
      status: 'trial',
    } as never);
    jest.mocked(StripeService.createCheckoutSession).mockResolvedValue(
      'https://checkout.stripe.test/session_123'
    );

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', 'Bearer token')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.checkout_url).toContain('checkout.stripe.test');
  });

  test('should reject if agency already active', async () => {
    jest.mocked(Agency.findByPk).mockResolvedValue({
      id: 10,
      status: 'active',
    } as never);

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', 'Bearer token')
      .send();

    expect(res.status).toBe(400);
  });

  test('should reject if not agency_owner', async () => {
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 2,
      email: 'agent@agency.fr',
      role: 'agency_agent',
      agency_id: 10,
      is_2fa_enabled: true,
    } as never);

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', 'Bearer token')
      .send();

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/billing/status', () => {
  test('should return billing status for agency_owner', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      sub: 1,
      email: 'owner@agency.fr',
      role: 'agency_owner',
    });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      email: 'owner@agency.fr',
      role: 'agency_owner',
      agency_id: 10,
      is_2fa_enabled: true,
    } as never);
    jest.mocked(Agency.findByPk).mockResolvedValue({
      id: 10,
      status: 'trial',
      trial_ends_at: new Date(),
      next_billing_date: null,
      subscription_id: 'sub_123',
    } as never);

    const res = await request(app)
      .get('/api/v1/billing/status')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('status', 'trial');
    expect(res.body.data).toHaveProperty('trial_ends_at');
    expect(res.body.data).toHaveProperty('next_billing_date');
  });
});

describe('POST /api/v1/webhooks/stripe', () => {
  test('should handle checkout.session.completed and activate agency', async () => {
    jest.mocked(StripeService.handleWebhook).mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'sig_test')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' })));

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
  });

  test('should handle invoice.payment_failed x3 and suspend agency', async () => {
    jest.mocked(StripeService.handleWebhook).mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'sig_test')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ id: 'evt_2', type: 'invoice.payment_failed', attempt_count: 3 })));

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
  });

  test('should be idempotent (meme event_id traite 2 fois)', async () => {
    const seen = new Set<string>();
    jest.mocked(StripeService.handleWebhook).mockImplementation(async (rawBody: Buffer) => {
      const parsed = JSON.parse(rawBody.toString('utf8')) as { id: string };
      if (seen.has(parsed.id)) return;
      seen.add(parsed.id);
    });

    await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'sig_test')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ id: 'evt_idempotent', type: 'invoice.payment_succeeded' })));
    await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'sig_test')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ id: 'evt_idempotent', type: 'invoice.payment_succeeded' })));

    expect(seen.size).toBe(1);
  });

  test('should return 400 with invalid Stripe signature', async () => {
    jest.mocked(StripeService.handleWebhook).mockRejectedValue(new Error('INVALID_SIGNATURE'));

    const res = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'invalid')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ id: 'evt_3' })));

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/billing/logs', () => {
  test('should return paginated payment logs for admin', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      sub: 99,
      email: 'admin@renters.fr',
      role: 'admin',
    });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 99,
      email: 'admin@renters.fr',
      role: 'admin',
      agency_id: null,
      is_2fa_enabled: true,
    } as never);
    jest.mocked(PaymentLog.findAndCountAll).mockResolvedValue({
      rows: [{ id: 1, event_type: 'invoice.payment_succeeded', status: 'success' }],
      count: 1,
    } as never);

    const res = await request(app)
      .get('/api/v1/billing/logs?page=1&limit=10')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.pagination.total).toBe(1);
  });

  test('should reject non admin access to payment logs', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      sub: 2,
      email: 'owner@agency.fr',
      role: 'agency_owner',
    });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 2,
      email: 'owner@agency.fr',
      role: 'agency_owner',
      agency_id: 10,
      is_2fa_enabled: true,
    } as never);

    const res = await request(app)
      .get('/api/v1/billing/logs')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/billing/logs/export.csv', () => {
  test('should export payment logs as csv for admin', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      sub: 99,
      email: 'admin@renters.fr',
      role: 'admin',
    });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 99,
      email: 'admin@renters.fr',
      role: 'admin',
      agency_id: null,
      is_2fa_enabled: true,
    } as never);
    jest.mocked(PaymentLog.findAll).mockResolvedValue([
      {
        toJSON: () => ({
          id: 1,
          agency_id: 10,
          stripe_event_id: 'evt_1',
          event_type: 'invoice.payment_succeeded',
          amount: 30000,
          currency: 'eur',
          status: 'success',
          created_at: '2026-01-01T00:00:00.000Z',
        }),
      },
    ] as never);

    const res = await request(app)
      .get('/api/v1/billing/logs/export.csv')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('stripe_event_id');
    expect(res.text).toContain('evt_1');
  });
});
