/**
 * Sprint 1 — Auth endpoints (with mocked DB)
 */
import request from 'supertest';
import { RefreshToken, User } from '../models';
import app from '../app';

jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn().mockResolvedValue([1]),
  },
  EmailVerificationToken: {
    findOne: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
  },
  RefreshToken: {
    findOne: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue([1]),
  },
  PasswordResetToken: {
    findOne: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
    destroy: jest.fn().mockResolvedValue(undefined),
  },
  Agency: {},
}));

describe('POST /auth/register', () => {
  beforeEach(() => {
    jest.mocked(User.findOne).mockResolvedValue(null);
    (User.create as jest.Mock).mockImplementation((args?: { email?: string }) =>
      Promise.resolve({
        id: 1,
        email: (args && args.email) || 'user@example.com',
        status: 'pending_verification',
      })
    );
  });

  test('returns 400 when validation fails', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        first_name: 'T',
        last_name: 'User',
        email: 'invalid',
        password: 'short',
        password_confirmation: 'short',
        accept_terms: false,
        accept_privacy: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 409 when email already exists', async () => {
    jest.mocked(User.findOne).mockResolvedValue({ id: 1, email: 'existing@example.com' } as never);
    const res = await request(app).post('/auth/register').send({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'existing@example.com',
      password: 'ValidPass123!',
      password_confirmation: 'ValidPass123!',
      accept_terms: true,
      accept_privacy: true,
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/déjà/);
  });

  test('returns 201 and user when valid', async () => {
    const res = await request(app).post('/auth/register').send({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'new@example.com',
      password: 'ValidPass123!',
      password_confirmation: 'ValidPass123!',
      accept_terms: true,
      accept_privacy: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      email: 'new@example.com',
      status: 'pending_verification',
    });
  });
});

describe('POST /auth/verify-email', () => {
  test('returns 400 when token is missing', async () => {
    const res = await request(app).post('/auth/verify-email').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 when body is invalid', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'x' });
    expect(res.status).toBe(400);
  });

  test('returns cookies when login succeeds', async () => {
    jest.mocked(User.findOne).mockResolvedValue({
      id: 10,
      email: 'tenant@example.com',
      status: 'active',
      role: 'tenant',
      password_hash: await (await import('bcrypt')).hash('ValidPass123!', 12),
      tenant_profile: 'employee_cdi',
      is_2fa_enabled: false,
      update: jest.fn().mockResolvedValue(undefined),
    } as never);

    const res = await request(app).post('/auth/login').send({
      email: 'tenant@example.com',
      password: 'ValidPass123!',
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.headers['set-cookie'])).toBe(true);
    expect(String(res.headers['set-cookie'])).toContain('access_token=');
    expect(String(res.headers['set-cookie'])).toContain('refresh_token=');
  });
});

describe('POST /auth/refresh', () => {
  test('returns 401 with invalid refresh cookie', async () => {
    jest.mocked(RefreshToken.findOne).mockResolvedValue(null);
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'refresh_token=dead-token');
    expect(res.status).toBe(401);
    expect(String(res.headers['set-cookie'])).toContain('Max-Age=0');
  });
});

describe('POST /auth/logout', () => {
  test('clears auth cookies', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', 'refresh_token=dead-token');
    expect(res.status).toBe(200);
    expect(String(res.headers['set-cookie'])).toContain('access_token=');
    expect(String(res.headers['set-cookie'])).toContain('refresh_token=');
    expect(String(res.headers['set-cookie'])).toContain('Max-Age=0');
  });
});
