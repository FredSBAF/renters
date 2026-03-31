import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { AuditLog, User } from '../../models';
import * as searchCriteriaService from '../../services/searchCriteria.service';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../../services/searchCriteria.service', () => ({
  getByUserId: jest.fn(),
  upsert: jest.fn(),
  generatePresentation: jest.fn(),
}));

jest.mock('../../models', () => ({
  User: { findByPk: jest.fn() },
  SearchCriteria: { findOne: jest.fn() },
  SearchCriteriaCity: {},
  SearchCriteriaPropertyType: {},
  AuditLog: { create: jest.fn() },
  Agency: {},
  RefreshToken: {},
  EmailVerificationToken: {},
  PasswordResetToken: {},
  UserConsent: {},
  PaymentLog: {},
  Folder: { findOne: jest.fn() },
  DocumentType: { findAll: jest.fn() },
  Document: { findAll: jest.fn() },
  SharingLink: {},
  SharingView: {},
  Guarantor: {},
  ModerationQueue: {},
  Notification: {},
  NotificationPreference: {},
}));

const payload = {
  cities: ['Paris'],
  property_types: ['T2'],
  budget_ideal: 900,
  budget_max: 1200,
  availability_type: 'immediate',
  tenant_profile: 'employee_cdi',
  first_name: 'Akira',
};

describe('POST /v1/search-criteria/generate-presentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 't@x.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      email: 't@x.fr',
      role: 'tenant',
      status: 'active',
      is_2fa_enabled: false,
      agency_id: null,
      ai_generation_count: 0,
      ai_generation_reset_at: null,
      increment: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    } as never);
  });

  test('200 returns generated text', async () => {
    jest.mocked(searchCriteriaService.generatePresentation).mockResolvedValue('Texte généré');
    const res = await request(app)
      .post('/v1/search-criteria/generate-presentation')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data.text).toBeTruthy();
    expect(AuditLog.create).toHaveBeenCalled();
  });

  test('200 truncation delegated from service', async () => {
    jest.mocked(searchCriteriaService.generatePresentation).mockResolvedValue('a'.repeat(500));
    const res = await request(app)
      .post('/v1/search-criteria/generate-presentation')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data.text.length).toBeLessThanOrEqual(500);
  });

  test('400 invalid body', async () => {
    const res = await request(app)
      .post('/v1/search-criteria/generate-presentation')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send({ ...payload, cities: [] });
    expect(res.status).toBe(400);
  });

  test('401 without JWT', async () => {
    const res = await request(app).post('/v1/search-criteria/generate-presentation').send(payload);
    expect(res.status).toBe(401);
  });

  test('429 when rate limited', async () => {
    jest
      .mocked(User.findByPk)
      .mockResolvedValueOnce({
        id: 1,
        email: 't@x.fr',
        role: 'tenant',
        status: 'active',
        is_2fa_enabled: false,
        agency_id: null,
      } as never)
      .mockResolvedValueOnce({
        id: 1,
        ai_generation_count: 5,
        ai_generation_reset_at: new Date(Date.now() + 60_000),
      } as never);
    const res = await request(app)
      .post('/v1/search-criteria/generate-presentation')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send(payload);
    expect(res.status).toBe(429);
  });
});
