import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { SearchCriteria, User } from '../../models';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
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

describe('GET /v1/search-criteria', () => {
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

  test('200 returns criteria with cities and property types', async () => {
    jest.mocked(SearchCriteria.findOne).mockResolvedValue({
      toJSON: () => ({
        id: 10,
        user_id: 1,
        cities: [{ id: 1, name: 'Paris', place_id: 'p1', lat: 48.85, lng: 2.35, radius_km: 5 }],
        property_types: ['T2'],
      }),
    } as never);

    const res = await request(app).get('/v1/search-criteria').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data.cities[0].search_criteria_id).toBeUndefined();
  });

  test('404 when criteria does not exist', async () => {
    jest.mocked(SearchCriteria.findOne).mockResolvedValue(null);
    const res = await request(app).get('/v1/search-criteria').set('Authorization', 'Bearer token');
    expect(res.status).toBe(404);
  });

  test('401 without JWT', async () => {
    const res = await request(app).get('/v1/search-criteria');
    expect(res.status).toBe(401);
  });
});
