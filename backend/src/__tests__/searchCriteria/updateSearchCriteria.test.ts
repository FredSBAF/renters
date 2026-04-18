import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { AuditLog, SearchCriteria, User } from '../../models';
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

const validPayload = {
  cities: [{ name: 'Paris', place_id: 'p1', lat: 48.85, lng: 2.35, radius_km: 5 }],
  property_types: ['T2'],
  budget_ideal: 800,
  budget_max: 1000,
  availability_type: 'immediate',
  availability_date: null,
  presentation_text: 'Locataire stable avec CDI et revenus réguliers.',
};

describe('PATCH /v1/search-criteria', () => {
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
    } as never);
  });

  test('201 creates first criteria', async () => {
    jest.mocked(searchCriteriaService.getByUserId).mockResolvedValueOnce(null);
    jest.mocked(searchCriteriaService.upsert).mockResolvedValue({
      id: 99,
      toJSON: () => ({ id: 99 }),
    } as never);

    const res = await request(app)
      .patch('/v1/search-criteria')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send(validPayload);

    expect(res.status).toBe(201);
  });

  test('201 accepts camelCase city fields', async () => {
    jest.mocked(searchCriteriaService.getByUserId).mockResolvedValueOnce(null);
    jest.mocked(searchCriteriaService.upsert).mockResolvedValue({
      id: 100,
      toJSON: () => ({ id: 100 }),
    } as never);

    const res = await request(app)
      .patch('/v1/search-criteria')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send({
        ...validPayload,
        cities: [{
          name: 'Paris',
          placeId: 'p1',
          lat: 48.85,
          lng: 2.35,
          radiusKm: 5,
        }],
      });

    expect(res.status).toBe(201);
  });

  test('200 updates existing criteria', async () => {
    jest.mocked(searchCriteriaService.getByUserId).mockResolvedValueOnce({ id: 12 } as never);
    jest.mocked(searchCriteriaService.upsert).mockResolvedValue({
      id: 12,
      toJSON: () => ({ id: 12 }),
    } as never);

    const res = await request(app)
      .patch('/v1/search-criteria')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(AuditLog.create).toHaveBeenCalled();
  });

  test('400 when cities is empty', async () => {
    const res = await request(app)
      .patch('/v1/search-criteria')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send({ ...validPayload, cities: [] });
    expect(res.status).toBe(400);
  });

  test('400 when budget_max < budget_ideal', async () => {
    const res = await request(app)
      .patch('/v1/search-criteria')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send({ ...validPayload, budget_ideal: 1000, budget_max: 900 });
    expect(res.status).toBe(400);
  });

  test('401 without JWT', async () => {
    const res = await request(app).patch('/v1/search-criteria').send(validPayload);
    expect(res.status).toBe(401);
  });

  test('403 for non-tenant role', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 'a@x.fr', role: 'agency_owner' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      email: 'a@x.fr',
      role: 'agency_owner',
      status: 'active',
      is_2fa_enabled: true,
      agency_id: 99,
    } as never);
    const res = await request(app)
      .patch('/v1/search-criteria')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  test('rollback path bubbles up service error', async () => {
    jest.mocked(searchCriteriaService.getByUserId).mockResolvedValueOnce(null);
    jest.mocked(searchCriteriaService.upsert).mockRejectedValueOnce(new Error('BULK_FAIL'));
    const res = await request(app)
      .patch('/v1/search-criteria')
      .set('Authorization', 'Bearer token')
      .set('Origin', 'http://localhost:3000')
      .send(validPayload);
    expect(res.status).toBe(500);
  });
});
