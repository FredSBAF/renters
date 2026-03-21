import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import app from '../app';
import { Agency, AuditLog, Document, DocumentType, Folder, User } from '../models';
import { S3Service } from '../services/S3Service';
import { WatermarkService } from '../services/WatermarkService';
import { runDocumentExpiryJob } from '../jobs/documentExpiry.job';
import { sendDocumentExpired, sendDocumentExpiringSoon } from '../services/EmailService';

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('../services/S3Service', () => ({
  S3Service: {
    uploadFile: jest.fn(),
    getPresignedUrl: jest.fn(),
    getFileBuffer: jest.fn(),
    deleteFile: jest.fn(),
  },
}));
jest.mock('../services/WatermarkService', () => ({
  WatermarkService: {
    watermarkDocument: jest.fn(),
    extractSteganography: jest.fn(),
  },
}));
jest.mock('../services/EmailService', () => ({
  sendDocumentExpiringSoon: jest.fn(),
  sendDocumentExpired: jest.fn(),
}));
jest.mock('../models', () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn() },
  Folder: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  Document: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  DocumentType: { findOne: jest.fn(), findAll: jest.fn() },
  Agency: { findByPk: jest.fn() },
  AuditLog: { create: jest.fn() },
  RefreshToken: {},
  EmailVerificationToken: {},
  PasswordResetToken: {},
  UserConsent: {},
  PaymentLog: {},
}));

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('POST /api/v1/documents/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 't@t.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      role: 'tenant',
      tenant_profile: 'employee_cdi',
      email: 't@t.fr',
      is_2fa_enabled: false,
    } as never);
    jest.mocked(Folder.findOne).mockResolvedValue({
      id: 11,
      user_id: 1,
      folder_status: 'active',
      deleted_at: null,
    } as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({
      id: 11,
      user_id: 1,
      deleted_at: null,
      update: jest.fn(),
    } as never);
    jest.mocked(DocumentType.findOne).mockResolvedValue({
      code: 'identity_card',
      validity_months: null,
    } as never);
    jest.mocked(DocumentType.findAll).mockResolvedValue([] as never);
    jest.mocked(Document.findOne).mockResolvedValue(null);
    jest.mocked(Document.create).mockResolvedValue({
      id: 100,
      folder_id: 11,
      document_type: 'identity_card',
      status: 'pending_analysis',
      file_path: 'users/1/documents/test.pdf',
      file_name: 'test.pdf',
      mime_type: 'application/pdf',
      toJSON: () => ({
        id: 100,
        status: 'pending_analysis',
        document_type: 'identity_card',
        file_path: 'users/1/documents/test.pdf',
      }),
      update: jest.fn(),
    } as never);
    jest.mocked(S3Service.uploadFile).mockResolvedValue('users/1/documents/test.pdf');
    jest.mocked(AuditLog.create).mockResolvedValue({} as never);
  });

  test('should upload PDF and create document entry', async () => {
    const res = await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', 'Bearer token')
      .field('document_type', 'identity_card')
      .attach('file', path.join(FIXTURES, 'test.pdf'));

    expect(res.status).toBe(201);
    expect(res.body.data.document.status).toBe('pending_analysis');
    expect(Document.create).toHaveBeenCalled();
  });

  test('should replace existing document of same type', async () => {
    const oldUpdate = jest.fn().mockResolvedValue(undefined);
    jest.mocked(Document.findOne).mockResolvedValue({
      id: 2,
      file_path: 'users/1/documents/old.pdf',
      deleted_at: null,
      update: oldUpdate,
    } as never);

    const res = await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', 'Bearer token')
      .field('document_type', 'identity_card')
      .attach('file', path.join(FIXTURES, 'test.pdf'));

    expect(res.status).toBe(201);
    expect(oldUpdate).toHaveBeenCalled();
  });

  test('should reject file > 5MB', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 1);
    const res = await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', 'Bearer token')
      .field('document_type', 'identity_card')
      .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('FILE_TOO_LARGE');
  });

  test('should reject unsupported format', async () => {
    const res = await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', 'Bearer token')
      .field('document_type', 'identity_card')
      .attach('file', Buffer.from('docx'), {
        filename: 'x.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('FORMAT_NOT_SUPPORTED');
  });

  test('should reject if not tenant role', async () => {
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      role: 'agency_owner',
      agency_id: 10,
      is_2fa_enabled: true,
    } as never);
    const res = await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', 'Bearer token')
      .send({ document_type: 'identity_card' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/documents/:id/download', () => {
  test('should return presigned URL for tenant', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 't@t.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      role: 'tenant',
      email: 't@t.fr',
      is_2fa_enabled: false,
    } as never);
    jest.mocked(Document.findByPk).mockResolvedValue({
      id: 10,
      folder_id: 11,
      file_path: 'users/1/documents/test.pdf',
      deleted_at: null,
    } as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({ id: 11, user_id: 1, deleted_at: null } as never);
    jest.mocked(S3Service.getPresignedUrl).mockResolvedValue('https://signed.url');

    const res = await request(app)
      .get('/api/v1/documents/10/download')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data.download_url).toBeDefined();
  });

  test('should reject if document belongs to another user', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 2, email: 'u2@t.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 2,
      role: 'tenant',
      email: 'u2@t.fr',
      is_2fa_enabled: false,
    } as never);
    jest.mocked(Document.findByPk).mockResolvedValue({
      id: 10,
      folder_id: 11,
      file_path: 'users/1/documents/test.pdf',
      deleted_at: null,
    } as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({ id: 11, user_id: 1, deleted_at: null } as never);

    const res = await request(app)
      .get('/api/v1/documents/10/download')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBeGreaterThanOrEqual(403);
  });
});

describe('GET /api/v1/documents/:id/download-agency', () => {
  test('should return watermarked buffer for agency', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 5, email: 'a@a.fr', role: 'agency_owner' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 5,
      role: 'agency_owner',
      email: 'a@a.fr',
      agency_id: 10,
      is_2fa_enabled: true,
    } as never);
    jest.mocked(Agency.findByPk).mockResolvedValue({ id: 10, status: 'active', name: 'Agence X' } as never);
    jest.mocked(Document.findByPk).mockResolvedValue({
      id: 99,
      folder_id: 11,
      mime_type: 'application/pdf',
      file_name: 'test.pdf',
      file_path: 'users/1/documents/test.pdf',
      deleted_at: null,
    } as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({ id: 11, user_id: 1, deleted_at: null } as never);
    jest.mocked(S3Service.getFileBuffer).mockResolvedValue(Buffer.from('pdf'));
    jest.mocked(WatermarkService.watermarkDocument).mockResolvedValue(Buffer.from('pdf-watermarked'));
    jest.mocked(AuditLog.create).mockResolvedValue({} as never);

    const res = await request(app)
      .get('/api/v1/documents/99/download-agency')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});

describe('DELETE /api/v1/documents/:id', () => {
  test('should soft delete document', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 1, email: 't@t.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      role: 'tenant',
      tenant_profile: 'employee_cdi',
      email: 't@t.fr',
      is_2fa_enabled: false,
    } as never);
    const updateMock = jest.fn();
    jest.mocked(Document.findByPk).mockResolvedValue({
      id: 7,
      folder_id: 11,
      file_path: 'users/1/documents/test.pdf',
      deleted_at: null,
      update: updateMock,
    } as never);
    (Folder.findByPk as jest.Mock).mockImplementation(async () => ({
      id: 11,
      user_id: 1,
      deleted_at: null,
      status: 'incomplete',
      update: jest.fn().mockResolvedValue(undefined),
    }));
    jest.mocked(DocumentType.findAll).mockResolvedValue([] as never);
    jest.mocked(S3Service.deleteFile).mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/v1/documents/7')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(204);
    expect(updateMock).toHaveBeenCalled();
    expect(S3Service.deleteFile).toHaveBeenCalled();
  });
});

describe('WatermarkService', () => {
  test('should add visible watermark to PDF', async () => {
    jest.resetModules();
    jest.unmock('../services/WatermarkService');
    const mod = await import('../services/WatermarkService');
    const input = fs.readFileSync(path.join(FIXTURES, 'test.pdf'));
    const output = await mod.WatermarkService.watermarkDocument({
      fileBuffer: input,
      mimeType: 'application/pdf',
      agencyName: 'Agence',
      agencyId: 10,
      userId: 1,
      documentId: 2,
      timestamp: new Date(),
    });
    expect(output.length).toBeGreaterThan(input.length);
  });

  test('should embed steganography metadata in PDF', async () => {
    jest.resetModules();
    jest.unmock('../services/WatermarkService');
    const mod = await import('../services/WatermarkService');
    const input = fs.readFileSync(path.join(FIXTURES, 'test.pdf'));
    const output = await mod.WatermarkService.watermarkDocument({
      fileBuffer: input,
      mimeType: 'application/pdf',
      agencyName: 'Agence',
      agencyId: 10,
      userId: 1,
      documentId: 2,
      timestamp: new Date(),
    });
    const meta = await mod.WatermarkService.extractSteganography(output, 'application/pdf');
    expect((meta as { agency_id: number }).agency_id).toBe(10);
  });

  test('should watermark JPEG image', async () => {
    jest.resetModules();
    jest.unmock('../services/WatermarkService');
    const mod = await import('../services/WatermarkService');
    const input = fs.readFileSync(path.join(FIXTURES, 'test.jpg'));
    const output = await mod.WatermarkService.watermarkDocument({
      fileBuffer: input,
      mimeType: 'image/jpeg',
      agencyName: 'Agence',
      agencyId: 10,
      userId: 1,
      documentId: 2,
      timestamp: new Date(),
    });
    expect(output.length).toBeGreaterThan(0);
  });
});

describe('documentExpiry CRON job', () => {
  test('should mark expired documents and send email', async () => {
    const expiringUpdate = jest.fn();
    jest.mocked(Document.findAll).mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      {
        id: 1,
        folder_id: 11,
        document_type: 'identity_card',
        file_path: 'users/1/documents/x.pdf',
        update: expiringUpdate,
      },
    ] as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({ id: 11, user_id: 1 } as never);
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      email: 't@t.fr',
      tenant_profile: 'employee_cdi',
    } as never);
    jest.mocked(DocumentType.findOne).mockResolvedValue({ label_fr: 'Carte' } as never);
    jest.mocked(S3Service.deleteFile).mockResolvedValue(undefined);
    await runDocumentExpiryJob();
    expect(expiringUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired' }));
    expect(sendDocumentExpired).toHaveBeenCalled();
  });

  test('should send warning email 7 days before expiry', async () => {
    const warnUpdate = jest.fn();
    jest.mocked(Document.findAll).mockResolvedValueOnce([
      {
        id: 2,
        folder_id: 11,
        document_type: 'identity_card',
        expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        update: warnUpdate,
      },
    ] as never).mockResolvedValueOnce([] as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({ id: 11, user_id: 1 } as never);
    jest.mocked(User.findByPk).mockResolvedValue({ id: 1, email: 't@t.fr' } as never);
    jest.mocked(DocumentType.findOne).mockResolvedValue({ label_fr: 'Carte' } as never);
    await runDocumentExpiryJob();
    expect(sendDocumentExpiringSoon).toHaveBeenCalled();
    expect(warnUpdate).toHaveBeenCalledWith(expect.objectContaining({ expiry_notified_at: expect.any(Date) }));
  });
});
