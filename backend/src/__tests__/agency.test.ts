import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { sequelize } from '../config/database';
import { Agency, EmailVerificationToken, User, UserConsent } from '../models';

jest.mock('../config/database', () => ({
  sequelize: {
    transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb({})),
  },
}));

jest.mock('../services/EmailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendAgencyInvitationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../models', () => ({
  Agency: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  EmailVerificationToken: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  UserConsent: {
    bulkCreate: jest.fn(),
  },
  RefreshToken: {},
  PasswordResetToken: {},
}));

describe('POST /agencies/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Agency.findOne).mockResolvedValue(null);
    jest.mocked(User.findOne).mockResolvedValue(null);
    (Agency.create as jest.Mock).mockImplementation(async (payload: Record<string, unknown>) => {
      return {
        id: 100,
        ...payload,
      } as never;
    });
    (User.create as jest.Mock).mockResolvedValue({
      id: 200,
      email: 'owner@agency.fr',
      role: 'agency_owner',
      toJSON: () => ({ id: 200, email: 'owner@agency.fr', role: 'agency_owner' }),
    });
    jest.mocked(EmailVerificationToken.create).mockResolvedValue({} as never);
    jest.mocked(UserConsent.bulkCreate).mockResolvedValue([] as never);
  });

  test('should create agency + owner with valid data', async () => {
    const res = await request(app).post('/agencies/register').send({
      name: 'Agence Lumiere',
      siret: '12345678901234',
      address: '12 rue de Paris',
      city: 'Paris',
      postal_code: '75001',
      phone: '0612345678',
      owner_email: 'owner@agency.fr',
      owner_password: 'Password123',
      accept_terms: true,
      accept_privacy: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.agency.status).toBe('trial');
    expect(res.body.data.owner.role).toBe('agency_owner');

    const agencyCreatePayload = (Agency.create as jest.Mock).mock.calls[0][0];
    const trialEndsAt = new Date(agencyCreatePayload.trial_ends_at);
    const now = Date.now();
    const deltaDays = (trialEndsAt.getTime() - now) / (1000 * 60 * 60 * 24);
    expect(deltaDays).toBeGreaterThan(29);
    expect(deltaDays).toBeLessThan(31);

    expect(UserConsent.bulkCreate).toHaveBeenCalledTimes(1);
    expect((UserConsent.bulkCreate as jest.Mock).mock.calls[0][0]).toHaveLength(3);
  });

  test('should reject duplicate SIRET', async () => {
    jest.mocked(Agency.findOne).mockResolvedValue({ id: 1 } as never);
    const res = await request(app).post('/agencies/register').send({
      name: 'Agence Lumiere',
      siret: '12345678901234',
      phone: '0612345678',
      owner_email: 'owner@agency.fr',
      owner_password: 'Password123',
      accept_terms: true,
      accept_privacy: true,
    });
    expect(res.status).toBe(409);
  });

  test('should reject duplicate owner email', async () => {
    jest.mocked(Agency.findOne).mockResolvedValue(null);
    jest.mocked(User.findOne).mockResolvedValue({ id: 5 } as never);
    const res = await request(app).post('/agencies/register').send({
      name: 'Agence Lumiere',
      siret: '12345678901234',
      phone: '0612345678',
      owner_email: 'owner@agency.fr',
      owner_password: 'Password123',
      accept_terms: true,
      accept_privacy: true,
    });
    expect(res.status).toBe(409);
  });

  test('should reject invalid SIRET format', async () => {
    const res = await request(app).post('/agencies/register').send({
      name: 'Agence Lumiere',
      siret: 'ABC',
      phone: '0612345678',
      owner_email: 'owner@agency.fr',
      owner_password: 'Password123',
      accept_terms: true,
      accept_privacy: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('should reject if accept_terms = false', async () => {
    const res = await request(app).post('/agencies/register').send({
      name: 'Agence Lumiere',
      siret: '12345678901234',
      phone: '0612345678',
      owner_email: 'owner@agency.fr',
      owner_password: 'Password123',
      accept_terms: false,
      accept_privacy: true,
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /agencies/team/invite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 'owner@agency.fr', role: 'agency_owner' });
    (User.findByPk as jest.Mock).mockImplementation(async (id: number) => {
      if (id === 1) {
        return {
          id: 1,
          email: 'owner@agency.fr',
          role: 'agency_owner',
          agency_id: 10,
          is_2fa_enabled: true,
        } as never;
      }
      return null;
    });
    jest.mocked(Agency.findByPk).mockResolvedValue({ id: 10, status: 'trial' } as never);
    jest.mocked(User.findOne).mockResolvedValue(null);
    jest.mocked(EmailVerificationToken.create).mockResolvedValue({} as never);
  });

  test('should invite new agent by email', async () => {
    const res = await request(app)
      .post('/agencies/team/invite')
      .set('Authorization', 'Bearer token')
      .send({ email: 'agent@agency.fr' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Invitation envoyée');
    expect(EmailVerificationToken.create).toHaveBeenCalledTimes(1);
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
      .post('/agencies/team/invite')
      .set('Authorization', 'Bearer token')
      .send({ email: 'x@agency.fr' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /agencies/team/:userId', () => {
  const agentUpdateMock = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    agentUpdateMock.mockClear();
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 'owner@agency.fr', role: 'agency_owner' });
    (User.findByPk as jest.Mock).mockImplementation(async (id: number) => {
      if (id === 1) {
        return {
          id: 1,
          email: 'owner@agency.fr',
          role: 'agency_owner',
          agency_id: 10,
          is_2fa_enabled: true,
        } as never;
      }
      if (id === 2) {
        return {
          id: 2,
          email: 'agent@agency.fr',
          role: 'agency_agent',
          agency_id: 10,
          update: agentUpdateMock,
        } as never;
      }
      return null;
    });
  });

  test('should remove agent from agency', async () => {
    const res = await request(app)
      .delete('/agencies/team/2')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(agentUpdateMock).toHaveBeenCalledWith({
      agency_id: null,
      role: 'tenant',
    });
  });

  test('should reject removing self (owner)', async () => {
    const res = await request(app)
      .delete('/agencies/team/1')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(400);
  });
});

describe('GET /agencies/team', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 2, email: 'agent@agency.fr', role: 'agency_agent' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 2,
      email: 'agent@agency.fr',
      role: 'agency_agent',
      agency_id: 10,
      is_2fa_enabled: true,
    } as never);
    jest.mocked(User.findAll).mockResolvedValue([
      {
        toJSON: () => ({ id: 1, email: 'owner@agency.fr', role: 'agency_owner' }),
      },
      {
        toJSON: () => ({ id: 2, email: 'agent@agency.fr', role: 'agency_agent' }),
      },
    ] as never);
  });

  test('should return all agency members', async () => {
    const res = await request(app).get('/agencies/team').set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.members)).toBe(true);
    expect(res.body.data.members[0].password_hash).toBeUndefined();
  });
});

describe('requireAgency2FA middleware', () => {
  test('should block agency user without 2FA', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 'owner@agency.fr', role: 'agency_owner' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      email: 'owner@agency.fr',
      role: 'agency_owner',
      agency_id: 10,
      is_2fa_enabled: false,
    } as never);

    const res = await request(app).get('/agencies/team').set('Authorization', 'Bearer token');
    expect(res.status).toBe(403);
  });
});

describe('Agency service transaction wrapper', () => {
  test('should use sequelize transaction for register flow', async () => {
    await request(app).post('/agencies/register').send({
      name: 'Agence Test',
      siret: '11112222333344',
      phone: '0612345678',
      owner_email: 'owner2@agency.fr',
      owner_password: 'Password123',
      accept_terms: true,
      accept_privacy: true,
    });
    expect(sequelize.transaction).toHaveBeenCalled();
  });
});
