import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { User } from '../models';

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('../models', () => ({
  User: { findByPk: jest.fn() },
  Agency: {},
  Folder: {},
  Document: {},
  DocumentType: {},
  AuditLog: {},
  SharingLink: {},
  SharingView: {},
  Guarantor: {},
  ModerationQueue: {},
  RefreshToken: {},
  EmailVerificationToken: {},
  PasswordResetToken: {},
  UserConsent: {},
  PaymentLog: {},
}));

describe('POST /api/v1/admin/moderation/:queueId/resolve', () => {
  test('should reject if not admin role', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 2, email: 'tenant@x.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 2,
      role: 'tenant',
      email: 'tenant@x.fr',
      is_2fa_enabled: false,
    } as never);
    const res = await request(app)
      .post('/api/v1/admin/moderation/1/resolve')
      .set('Authorization', 'Bearer token')
      .send({ resolution: 'approved' });
    expect(res.status).toBe(403);
  });
});
