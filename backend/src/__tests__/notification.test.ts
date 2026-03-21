import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { User } from '../models';
import { NotificationService } from '../services/NotificationService';

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('../services/NotificationService', () => ({
  NotificationService: {
    getNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    getOrCreatePreferences: jest.fn(),
    updatePreferences: jest.fn(),
  },
}));
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
  Notification: {},
  NotificationPreference: {},
}));

beforeEach(() => {
  (jwt.verify as jest.Mock).mockReturnValue({ sub: 2, email: 'tenant@x.fr', role: 'tenant' });
  jest.mocked(User.findByPk).mockResolvedValue({
    id: 2,
    role: 'tenant',
    email: 'tenant@x.fr',
    is_2fa_enabled: false,
  } as never);
});

describe('GET /api/v1/notifications', () => {
  test('should return paginated notifications', async () => {
    (NotificationService.getNotifications as jest.Mock).mockResolvedValue({
      notifications: [{ id: 1, is_read: false }],
      total: 1,
      unread_count: 1,
    });
    const res = await request(app).get('/api/v1/notifications').set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });
});

describe('GET /api/v1/notifications/unread-count', () => {
  test('should return unread count', async () => {
    (NotificationService.getUnreadCount as jest.Mock).mockResolvedValue(4);
    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data.unread_count).toBe(4);
  });
});

describe('PATCH /api/v1/notifications/preferences', () => {
  test('should reject empty body', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(400);
  });
});
