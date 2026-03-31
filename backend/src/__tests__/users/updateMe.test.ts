import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { AuditLog, User } from '../../models';
import { recalculateFolderCompletion } from '../../services/folder.service';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../../services/folder.service', () => ({
  recalculateFolderCompletion: jest.fn(),
}));

jest.mock('../../models', () => ({
  User: {
    findByPk: jest.fn(),
  },
  AuditLog: {
    create: jest.fn(),
  },
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

describe('PATCH /v1/users/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 123, email: 'u@test.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValueOnce({
      id: 123,
      email: 'u@test.fr',
      role: 'tenant',
      status: 'active',
      agency_id: null,
      is_2fa_enabled: false,
      update: jest.fn().mockResolvedValue(undefined),
      toPublicJSON: jest.fn().mockReturnValue({ id: 123 }),
    } as never);
  });

  test('returns 200 for first_name update only', async () => {
    const user = {
      id: 123,
      email: 'u@test.fr',
      status: 'active',
      deleted_at: null,
      tenant_profile: 'employee_cdi',
      update: jest.fn().mockResolvedValue(undefined),
      toPublicJSON: jest.fn().mockReturnValue({ id: 123, first_name: 'Jean' }),
    };
    jest.mocked(User.findByPk).mockResolvedValueOnce(user as never);

    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer token')
      .send({ first_name: 'Jean' });

    expect(res.status).toBe(200);
    expect(user.update).toHaveBeenCalledWith({ first_name: 'Jean' });
  });

  test('returns 200 and recalculates folder on tenant_profile update', async () => {
    const user = {
      id: 123,
      email: 'u@test.fr',
      status: 'active',
      deleted_at: null,
      tenant_profile: 'employee_cdi',
      update: jest.fn().mockImplementation(async (payload: { tenant_profile?: string }) => {
        if (payload.tenant_profile) user.tenant_profile = payload.tenant_profile;
      }),
      toPublicJSON: jest.fn().mockReturnValue({ id: 123, tenant_profile: 'student' }),
    };
    jest.mocked(User.findByPk).mockResolvedValueOnce(user as never);

    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer token')
      .send({ tenant_profile: 'student' });

    expect(res.status).toBe(200);
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'profile.tenant_profile_updated' })
    );
    expect(recalculateFolderCompletion).toHaveBeenCalledWith(123);
  });

  test('returns 400 for invalid future date_of_birth', async () => {
    const user = {
      id: 123,
      email: 'u@test.fr',
      status: 'active',
      deleted_at: null,
      tenant_profile: 'employee_cdi',
    };
    jest.mocked(User.findByPk).mockResolvedValueOnce(user as never);
    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer token')
      .send({ date_of_birth: '2999-01-01' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for unknown tenant_profile', async () => {
    const user = {
      id: 123,
      email: 'u@test.fr',
      status: 'active',
      deleted_at: null,
      tenant_profile: 'employee_cdi',
    };
    jest.mocked(User.findByPk).mockResolvedValueOnce(user as never);
    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer token')
      .send({ tenant_profile: 'unknown_profile' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for empty body', async () => {
    const user = {
      id: 123,
      email: 'u@test.fr',
      status: 'active',
      deleted_at: null,
      tenant_profile: 'employee_cdi',
    };
    jest.mocked(User.findByPk).mockResolvedValueOnce(user as never);
    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(400);
  });

  test('returns 401 without JWT', async () => {
    const res = await request(app).patch('/v1/users/me').send({ first_name: 'Jean' });
    expect(res.status).toBe(401);
  });

  test('never returns password_hash in response', async () => {
    const user = {
      id: 123,
      email: 'u@test.fr',
      status: 'active',
      deleted_at: null,
      tenant_profile: 'employee_cdi',
      update: jest.fn().mockResolvedValue(undefined),
      toPublicJSON: jest.fn().mockReturnValue({ id: 123, email: 'u@test.fr' }),
      password_hash: 'secret',
    };
    jest.mocked(User.findByPk).mockResolvedValueOnce(user as never);

    const res = await request(app)
      .patch('/v1/users/me')
      .set('Authorization', 'Bearer token')
      .send({ first_name: 'Jean' });

    expect(res.status).toBe(200);
    expect(res.body.data.password_hash).toBeUndefined();
  });
});
