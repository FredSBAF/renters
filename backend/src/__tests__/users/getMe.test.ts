import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { User } from '../../models';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../../models', () => ({
  User: {
    findByPk: jest.fn(),
  },
  AuditLog: { create: jest.fn() },
  Folder: { findOne: jest.fn(), update: jest.fn() },
  DocumentType: { findAll: jest.fn() },
  Document: { findAll: jest.fn() },
  Agency: {},
  RefreshToken: {},
  EmailVerificationToken: {},
  PasswordResetToken: {},
  UserConsent: {},
  PaymentLog: {},
  SharingLink: {},
  SharingView: {},
  Guarantor: {},
  ModerationQueue: {},
  Notification: {},
  NotificationPreference: {},
}));

describe('GET /v1/users/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with valid JWT and public user data', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 123, email: 'u@test.fr', role: 'tenant' });
    const user = {
      id: 123,
      email: 'u@test.fr',
      status: 'active',
      deleted_at: null,
      toPublicJSON: jest.fn().mockReturnValue({
        id: 123,
        email: 'u@test.fr',
        first_name: 'Jean',
        tenant_profile: 'employee_cdi',
      }),
    };
    jest.mocked(User.findByPk).mockResolvedValue(user as never);

    const res = await request(app).get('/v1/users/me').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.password_hash).toBeUndefined();
  });

  test('returns 401 without JWT', async () => {
    const res = await request(app).get('/v1/users/me');
    expect(res.status).toBe(401);
  });

  test('returns 401 with expired JWT', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const res = await request(app).get('/v1/users/me').set('Authorization', 'Bearer bad');
    expect(res.status).toBe(401);
  });

  test('returns 404 if user deleted between auth and controller', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 123, email: 'u@test.fr', role: 'tenant' });
    jest
      .mocked(User.findByPk)
      .mockResolvedValueOnce({
        id: 123,
        email: 'u@test.fr',
        role: 'tenant',
        status: 'active',
        agency_id: null,
        is_2fa_enabled: false,
      } as never)
      .mockResolvedValueOnce({
        id: 123,
        email: 'u@test.fr',
        status: 'active',
        deleted_at: new Date(),
        toPublicJSON: jest.fn(),
      } as never);

    const res = await request(app).get('/v1/users/me').set('Authorization', 'Bearer token');
    expect(res.status).toBe(404);
  });
});
