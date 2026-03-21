import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { User } from '../models';
import { MetricsService } from '../services/MetricsService';
import { AdminUserService } from '../services/AdminUserService';

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('../services/MetricsService', () => ({
  MetricsService: {
    getBusinessMetrics: jest.fn(),
    getOperationalMetrics: jest.fn(),
    getEfficiencyMetrics: jest.fn(),
    getTimeSeriesData: jest.fn(),
    exportMetricsCSV: jest.fn(),
  },
}));
jest.mock('../services/AdminUserService', () => ({
  AdminUserService: {
    searchUsers: jest.fn(),
    suspendUser: jest.fn(),
    deleteUser: jest.fn(),
    exportUserData: jest.fn(),
    getAuditLogs: jest.fn(),
    getUserDetails: jest.fn(),
    reactivateUser: jest.fn(),
    changeUserRole: jest.fn(),
  },
}));
jest.mock('../models', () => ({
  User: { findByPk: jest.fn() },
  Agency: {},
  Folder: {},
  Document: {},
  DocumentType: {},
  AuditLog: { create: jest.fn() },
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

const asAdmin = () => {
  (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 'admin@x.fr', role: 'admin' });
  jest.mocked(User.findByPk).mockResolvedValue({
    id: 1,
    role: 'admin',
    email: 'admin@x.fr',
    is_2fa_enabled: true,
  } as never);
};

const asTenant = () => {
  (jwt.verify as jest.Mock).mockReturnValue({ sub: 2, email: 'tenant@x.fr', role: 'tenant' });
  jest.mocked(User.findByPk).mockResolvedValue({
    id: 2,
    role: 'tenant',
    email: 'tenant@x.fr',
    is_2fa_enabled: false,
  } as never);
};

describe('GET /api/v1/admin/dashboard/metrics', () => {
  test('should return all metrics sections', async () => {
    asAdmin();
    (MetricsService.getBusinessMetrics as jest.Mock).mockResolvedValue({
      tenants: { total: 10 },
      revenue: { mrr: 900 },
    });
    (MetricsService.getOperationalMetrics as jest.Mock).mockResolvedValue({});
    (MetricsService.getEfficiencyMetrics as jest.Mock).mockResolvedValue({});
    const res = await request(app)
      .get('/api/v1/admin/dashboard/metrics')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data.business).toBeDefined();
    expect(res.body.data.operational).toBeDefined();
    expect(res.body.data.efficiency).toBeDefined();
    expect(res.body.data.generated_at).toBeDefined();
  });

  test('should reject non-admin user', async () => {
    asTenant();
    const res = await request(app)
      .get('/api/v1/admin/dashboard/metrics')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/admin/dashboard/timeseries', () => {
  test('should return continuous date series with no gaps', async () => {
    asAdmin();
    (MetricsService.getTimeSeriesData as jest.Mock).mockResolvedValue(
      Array.from({ length: 7 }).map((_, i) => ({ date: `2026-02-0${i + 1}`, value: i === 2 ? 1 : 0 }))
    );
    const res = await request(app)
      .get('/api/v1/admin/dashboard/timeseries?metric=new_tenants&period=week&granularity=day')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(7);
  });
});

describe('GET /api/v1/admin/dashboard/export', () => {
  test('should export tenants CSV with BOM', async () => {
    asAdmin();
    (MetricsService.exportMetricsCSV as jest.Mock).mockResolvedValue('\ufeffid;email;status');
    const res = await request(app)
      .get('/api/v1/admin/dashboard/export?type=tenants')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/csv');
    expect(res.text.startsWith('\ufeff')).toBe(true);
    expect(res.text).toContain('id;email;status');
  });
});

describe('GET /api/v1/admin/users', () => {
  test('should return paginated users list', async () => {
    asAdmin();
    (AdminUserService.searchUsers as jest.Mock).mockResolvedValue({
      users: [{ id: 3, email: 'jean@x.fr', role: 'tenant' }],
      total: 1,
      page: 1,
      limit: 20,
    });
    const res = await request(app).get('/api/v1/admin/users').set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });
});

describe('POST /api/v1/admin/users/:userId/suspend', () => {
  test('should suspend user', async () => {
    asAdmin();
    (AdminUserService.suspendUser as jest.Mock).mockResolvedValue(undefined);
    const res = await request(app)
      .post('/api/v1/admin/users/10/suspend')
      .set('Authorization', 'Bearer token')
      .send({ reason: 'Violation des CGU importante.' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/v1/admin/users/:userId', () => {
  test('should reject without confirm true', async () => {
    asAdmin();
    const res = await request(app)
      .delete('/api/v1/admin/users/10')
      .set('Authorization', 'Bearer token')
      .send({ confirm: false });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/admin/users/:userId/export', () => {
  test('should return ZIP with user data', async () => {
    asAdmin();
    (AdminUserService.exportUserData as jest.Mock).mockResolvedValue(Buffer.from('zip'));
    const res = await request(app)
      .get('/api/v1/admin/users/10/export')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/zip');
    expect(res.body).toBeDefined();
  });
});

describe('GET /api/v1/admin/audit-logs', () => {
  test('should return paginated audit logs', async () => {
    asAdmin();
    (AdminUserService.getAuditLogs as jest.Mock).mockResolvedValue({ logs: [{ action: 'document.uploaded' }], total: 1 });
    const res = await request(app).get('/api/v1/admin/audit-logs').set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });
});
