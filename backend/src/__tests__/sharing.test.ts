import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { Agency, AuditLog, Folder, SharingLink, SharingView, User } from '../models';

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

jest.mock('../models', () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn() },
  Folder: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  SharingLink: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    increment: jest.fn(),
  },
  SharingView: { create: jest.fn(), findOne: jest.fn(), findAll: jest.fn() },
  Agency: { findByPk: jest.fn() },
  AuditLog: { create: jest.fn() },
  Document: {},
  DocumentType: {},
  RefreshToken: {},
  EmailVerificationToken: {},
  PasswordResetToken: {},
  UserConsent: {},
  PaymentLog: {},
}));

describe('POST /api/v1/sharing/links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 't@t.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      email: 't@t.fr',
      role: 'tenant',
      tenant_profile: 'employee_cdi',
      is_2fa_enabled: false,
    } as never);
    jest.mocked(Folder.findOne).mockResolvedValue({
      id: 10,
      user_id: 1,
      folder_status: 'active',
      deleted_at: null,
      user: {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1990-01-01',
        phone: '0600000000',
        email: 'tenant@x.fr',
        tenant_profile: 'employee_cdi',
      },
    } as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({
      id: 10,
      user_id: 1,
      folder_status: 'active',
      deleted_at: null,
    } as never);
    jest.mocked(SharingLink.create).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      folder_id: 10,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      context: null,
    } as never);
  });

  test('should create sharing link with context', async () => {
    const res = await request(app)
      .post('/api/v1/sharing/links')
      .set('Authorization', 'Bearer token')
      .send({ context: { property_type: 'T2', city: 'Paris', budget: 1200 } });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toContain('11111111-1111-4111-8111-111111111111');
    expect(AuditLog.create).toHaveBeenCalled();
  });

  test('should create link without context', async () => {
    const res = await request(app)
      .post('/api/v1/sharing/links')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(201);
  });

  test('should reject if folder not active', async () => {
    jest.mocked(Folder.findByPk).mockResolvedValue({
      id: 10,
      user_id: 1,
      folder_status: 'standby',
      deleted_at: null,
    } as never);
    const res = await request(app)
      .post('/api/v1/sharing/links')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(400);
  });

  test('should reject if not tenant role', async () => {
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 2,
      role: 'agency_owner',
      agency_id: 10,
      is_2fa_enabled: true,
    } as never);
    const res = await request(app)
      .post('/api/v1/sharing/links')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/sharing/view/:linkId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(SharingLink.findByPk).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      folder_id: 10,
      revoked_at: null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      update: jest.fn(),
    } as never);
    jest.mocked(SharingView.create).mockResolvedValue({} as never);
    jest.mocked(SharingLink.increment).mockResolvedValue([1] as never);
    jest.mocked(Folder.findOne).mockResolvedValue({
      id: 10,
      user_id: 1,
      folder_status: 'active',
      deleted_at: null,
      user: {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1990-01-01',
        phone: '0600000000',
        email: 'tenant@x.fr',
        tenant_profile: 'employee_cdi',
      },
    } as never);
    jest.mocked(AuditLog.create).mockResolvedValue({} as never);
  });

  test('should return limited view for unauthenticated visitor', async () => {
    const res = await request(app).get('/api/v1/sharing/view/11111111-1111-4111-8111-111111111111');
    expect(res.status).toBe(200);
    expect(res.body.data.accessLevel).toBe('limited');
    expect(SharingView.create).toHaveBeenCalled();
  });

  test('should return limited view for non-paying agency', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 7, email: 'a@a.fr', role: 'agency_owner' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 7,
      role: 'agency_owner',
      agency_id: 99,
      is_2fa_enabled: true,
      email: 'a@a.fr',
    } as never);
    jest.mocked(Agency.findByPk).mockResolvedValue({ id: 99, status: 'cancelled' } as never);
    const res = await request(app)
      .get('/api/v1/sharing/view/11111111-1111-4111-8111-111111111111')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data.accessLevel).toBe('limited');
  });

  test('should return full view for active agency', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 7, email: 'a@a.fr', role: 'agency_owner' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 7,
      role: 'agency_owner',
      agency_id: 99,
      is_2fa_enabled: true,
      email: 'a@a.fr',
    } as never);
    jest.mocked(Agency.findByPk).mockResolvedValue({ id: 99, status: 'active' } as never);
    const res = await request(app)
      .get('/api/v1/sharing/view/11111111-1111-4111-8111-111111111111')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data.accessLevel).toBe('full');
  });

  test('should return full view for trial agency', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 7, email: 'a@a.fr', role: 'agency_agent' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 7,
      role: 'agency_agent',
      agency_id: 99,
      is_2fa_enabled: true,
      email: 'a@a.fr',
    } as never);
    jest.mocked(Agency.findByPk).mockResolvedValue({ id: 99, status: 'trial' } as never);
    const res = await request(app)
      .get('/api/v1/sharing/view/11111111-1111-4111-8111-111111111111')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data.accessLevel).toBe('full');
  });

  test('should capture viewer email as lead', async () => {
    const res = await request(app).get(
      '/api/v1/sharing/view/11111111-1111-4111-8111-111111111111?email=lead@agence.fr'
    );
    expect(res.status).toBe(200);
    expect(SharingView.create).toHaveBeenCalledWith(expect.objectContaining({ viewer_email: 'lead@agence.fr' }));
  });

  test('should return 410 for revoked link', async () => {
    jest.mocked(SharingLink.findByPk).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      folder_id: 10,
      revoked_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } as never);
    const res = await request(app).get('/api/v1/sharing/view/11111111-1111-4111-8111-111111111111');
    expect(res.status).toBe(410);
  });

  test('should return 410 for expired link', async () => {
    jest.mocked(SharingLink.findByPk).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      folder_id: 10,
      revoked_at: null,
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
    } as never);
    const res = await request(app).get('/api/v1/sharing/view/11111111-1111-4111-8111-111111111111');
    expect(res.status).toBe(410);
  });

  test('should return 404 for non-existent link', async () => {
    jest.mocked(SharingLink.findByPk).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/sharing/view/11111111-1111-4111-8111-111111111111');
    expect(res.status).toBe(404);
  });

  test('should reject if tenant tries to consult', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 't@t.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      role: 'tenant',
      email: 't@t.fr',
      is_2fa_enabled: false,
    } as never);
    const res = await request(app)
      .get('/api/v1/sharing/view/11111111-1111-4111-8111-111111111111')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/sharing/links/:linkId', () => {
  test('should revoke link', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 't@t.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      role: 'tenant',
      email: 't@t.fr',
      is_2fa_enabled: false,
    } as never);
    const update = jest.fn();
    jest.mocked(SharingLink.findByPk).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      folder_id: 10,
      revoked_at: null,
      update,
    } as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({ id: 10, user_id: 1 } as never);

    const res = await request(app)
      .delete('/api/v1/sharing/links/11111111-1111-4111-8111-111111111111')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(204);
    expect(update).toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/sharing/links/:linkId/extend', () => {
  test('should extend link by 30 days', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 't@t.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      role: 'tenant',
      email: 't@t.fr',
      is_2fa_enabled: false,
    } as never);
    const update = jest.fn();
    const expires = new Date();
    jest.mocked(SharingLink.findByPk).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      folder_id: 10,
      revoked_at: null,
      expires_at: expires,
      update,
    } as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({ id: 10, user_id: 1 } as never);

    const res = await request(app)
      .patch('/api/v1/sharing/links/11111111-1111-4111-8111-111111111111/extend')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });

  test('should reject extension of revoked link', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 't@t.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      role: 'tenant',
      email: 't@t.fr',
      is_2fa_enabled: false,
    } as never);
    jest.mocked(SharingLink.findByPk).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      folder_id: 10,
      revoked_at: new Date(),
      expires_at: new Date(),
    } as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({ id: 10, user_id: 1 } as never);
    const res = await request(app)
      .patch('/api/v1/sharing/links/11111111-1111-4111-8111-111111111111/extend')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/sharing/history', () => {
  test('should return consultation history for tenant', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 't@t.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      role: 'tenant',
      email: 't@t.fr',
      is_2fa_enabled: false,
    } as never);
    jest.mocked(Folder.findOne).mockResolvedValue({ id: 10, user_id: 1 } as never);
    jest.mocked(SharingLink.findAll).mockResolvedValue([
      { id: 'l1' },
    ] as never);
    jest.mocked(SharingView.findAll).mockResolvedValue([
      {
        viewed_at: new Date(),
        agency_id: 99,
        viewer_email: null,
        access_level: 'full',
        documents_downloaded: [1, 2],
      },
      {
        viewed_at: new Date(),
        agency_id: null,
        viewer_email: 'lead@x.fr',
        access_level: 'limited',
        documents_downloaded: [],
      },
    ] as never);
    jest.mocked(Agency.findByPk).mockResolvedValue({ id: 99, name: 'Agence 99' } as never);

    const res = await request(app)
      .get('/api/v1/sharing/history')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.history)).toBe(true);
  });
});

describe('POST /api/v1/sharing/track-download', () => {
  test('should track document download in sharing view', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 7, email: 'a@a.fr', role: 'agency_owner' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 7,
      role: 'agency_owner',
      agency_id: 99,
      email: 'a@a.fr',
      is_2fa_enabled: true,
    } as never);
    const update = jest.fn();
    jest.mocked(SharingView.findOne).mockResolvedValue({
      documents_downloaded: [],
      update,
    } as never);
    const res = await request(app)
      .post('/api/v1/sharing/track-download')
      .set('Authorization', 'Bearer token')
      .send({ link_id: '11111111-1111-4111-8111-111111111111', document_id: 123 });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });

  test('should not duplicate document_id in tracking', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 7, email: 'a@a.fr', role: 'agency_owner' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 7,
      role: 'agency_owner',
      agency_id: 99,
      email: 'a@a.fr',
      is_2fa_enabled: true,
    } as never);
    const update = jest.fn();
    jest.mocked(SharingView.findOne).mockResolvedValue({
      documents_downloaded: [123],
      update,
    } as never);
    const res = await request(app)
      .post('/api/v1/sharing/track-download')
      .set('Authorization', 'Bearer token')
      .send({ link_id: '11111111-1111-4111-8111-111111111111', document_id: 123 });
    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });
});
