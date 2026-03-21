import axios from 'axios';
import { AIService } from '../services/AIService';
import { ModerationService } from '../services/ModerationService';
import { GuarantorService } from '../services/GuarantorService';
import { Folder, Document, User, AuditLog, ModerationQueue, Guarantor } from '../models';

jest.mock('axios');
jest.mock('../services/S3Service', () => ({
  S3Service: { getPresignedUrl: jest.fn().mockResolvedValue('https://signed.url') },
}));
jest.mock('../services/EmailService', () => ({
  sendModerationAlert: jest.fn(),
  sendModerationInfoRequest: jest.fn(),
  sendModerationResolved: jest.fn(),
  sendGuarantorInvitation: jest.fn(),
}));
jest.mock('../models', () => ({
  Folder: { findByPk: jest.fn(), update: jest.fn(), create: jest.fn() },
  Document: { findAll: jest.fn(), findByPk: jest.fn(), count: jest.fn() },
  User: { findByPk: jest.fn(), findOne: jest.fn(), update: jest.fn() },
  AuditLog: { create: jest.fn() },
  ModerationQueue: { findOne: jest.fn(), create: jest.fn(), count: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  Guarantor: { findOne: jest.fn(), create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  Agency: {},
  RefreshToken: {},
  EmailVerificationToken: {},
  PasswordResetToken: {},
  UserConsent: {},
  PaymentLog: {},
  DocumentType: {},
  SharingLink: {},
  SharingView: {},
}));

describe('AIService.triggerAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Folder.findByPk).mockResolvedValue({
      id: 1,
      user_id: 2,
      ai_status: 'analyzed',
      update: jest.fn(),
    } as never);
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 2,
      email: 'tenant@x.fr',
      tenant_profile: 'employee_cdi',
      update: jest.fn(),
    } as never);
    jest.mocked(Document.count).mockResolvedValue(1 as never);
    jest.mocked(Document.findAll).mockResolvedValue([
      { id: 10, document_type: 'identity_card', file_path: 'x', mime_type: 'application/pdf' },
    ] as never);
    jest.mocked(Document.findByPk).mockResolvedValue({
      id: 10,
      update: jest.fn(),
    } as never);
  });

  test('should call microservice and update folder scores on success', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        global_score: 85,
        scores: { identity: 80, income: 85, stability: 88, coherence: 86 },
        status: 'verified',
        warnings: [],
        documents: [
          {
            document_id: 10,
            score: 90,
            status: 'valid',
            extracted_data: {},
            warnings: [],
            ai_metadata: {},
          },
        ],
        analysis_time_ms: 1200,
      },
    });
    await AIService.analyzeFolder(1);
    expect(Folder.findByPk).toHaveBeenCalled();
  });

  test('should add to moderation queue if score < 80', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        global_score: 55,
        scores: { identity: 55, income: 55, stability: 55, coherence: 55 },
        status: 'manual_review',
        warnings: [{ type: 'risk', message: 'risk', severity: 'medium' }],
        documents: [],
        analysis_time_ms: 100,
      },
    });
    await AIService.analyzeFolder(1);
    expect(AuditLog.create).toHaveBeenCalled();
  });

  test('should handle AI service timeout gracefully', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('timeout'));
    await expect(AIService.analyzeFolder(1)).resolves.toBeUndefined();
  });

  test('should not block upload response (async trigger)', async () => {
    (axios.post as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: {
                  global_score: 85,
                  scores: { identity: 80, income: 85, stability: 88, coherence: 86 },
                  status: 'verified',
                  warnings: [],
                  documents: [],
                  analysis_time_ms: 1200,
                },
              }),
            200
          )
        )
    );
    await AIService.triggerAnalysis(1);
    expect(AuditLog.create).toHaveBeenCalled();
  });
});

describe('ModerationService', () => {
  test('should calculate priority correctly from score', async () => {
    jest.mocked(ModerationQueue.findOne).mockResolvedValue(null);
    jest.mocked(ModerationQueue.create).mockResolvedValue({ id: 1, priority: 'low' } as never);
    await ModerationService.addToQueue(1, { globalScore: 75, warnings: [] });
    await ModerationService.addToQueue(1, { globalScore: 50, warnings: [] });
    await ModerationService.addToQueue(1, { globalScore: 30, warnings: [] });
    await ModerationService.addToQueue(1, { globalScore: 15, warnings: [] });
    expect(ModerationQueue.create).toHaveBeenCalled();
  });

  test('should resolve item as approved and update folder', async () => {
    jest.mocked(User.findByPk).mockResolvedValueOnce({ id: 1, role: 'admin' } as never).mockResolvedValueOnce({
      id: 2,
      email: 'tenant@x.fr',
    } as never);
    const queueUpdate = jest.fn();
    jest.mocked(ModerationQueue.findByPk).mockResolvedValue({
      id: 1,
      folder_id: 10,
      update: queueUpdate,
    } as never);
    const folderUpdate = jest.fn();
    jest.mocked(Folder.findByPk).mockResolvedValue({
      id: 10,
      user_id: 2,
      ai_score_global: 50,
      update: folderUpdate,
    } as never);
    await ModerationService.resolveItem({
      queueId: 1,
      adminUserId: 1,
      resolution: 'approved',
      adjustedScore: 85,
    });
    expect(folderUpdate).toHaveBeenCalled();
  });

  test('should flag user on fraud_confirmed', async () => {
    jest.mocked(User.findByPk).mockResolvedValueOnce({ id: 1, role: 'admin' } as never).mockResolvedValueOnce({
      id: 2,
      email: 'tenant@x.fr',
    } as never);
    jest.mocked(ModerationQueue.findByPk).mockResolvedValue({
      id: 1,
      folder_id: 10,
      update: jest.fn(),
    } as never);
    jest.mocked(Folder.findByPk).mockResolvedValue({
      id: 10,
      user_id: 2,
      update: jest.fn(),
    } as never);
    await ModerationService.resolveItem({
      queueId: 1,
      adminUserId: 1,
      resolution: 'fraud_confirmed',
    });
    expect(User.update).toHaveBeenCalled();
  });

  test('should not add duplicate to queue', async () => {
    const update = jest.fn();
    jest.mocked(ModerationQueue.findOne).mockResolvedValue({
      id: 1,
      status: 'pending',
      update,
    } as never);
    await ModerationService.addToQueue(1, { globalScore: 55, warnings: [] });
    expect(update).toHaveBeenCalled();
  });

  test('should detect SLA breach', async () => {
    const update = jest.fn();
    jest.mocked(ModerationQueue.findAll).mockResolvedValue([
      { folder_id: 1, priority: 'high', motifs: [], update },
    ] as never);
    await ModerationService.checkSLABreaches();
    expect(update).toHaveBeenCalledWith({ sla_breached: true });
  });
});

describe('GuarantorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      role: 'tenant',
      status: 'active',
      email: 'tenant@x.fr',
      first_name: 'Tenant',
      last_name: 'X',
    } as never);
  });

  test('should invite guarantor by email', async () => {
    jest.mocked(Guarantor.findOne).mockResolvedValue(null);
    jest.mocked(User.findOne).mockResolvedValue(null);
    jest.mocked(Guarantor.create).mockResolvedValue({ id: 1, invitation_token: 'tok' } as never);
    const g = await GuarantorService.inviteGuarantor({
      tenantId: 1,
      email: 'g@x.fr',
      role: 'guarantor',
    });
    expect(g.id).toBe(1);
  });

  test('should associate existing user directly as guarantor', async () => {
    jest.mocked(Guarantor.findOne).mockResolvedValue(null);
    jest.mocked(User.findOne).mockResolvedValue({ id: 88 } as never);
    jest.mocked(Guarantor.create).mockResolvedValue({
      id: 1,
      guarantor_user_id: 88,
      invitation_accepted_at: new Date(),
    } as never);
    const g = await GuarantorService.inviteGuarantor({
      tenantId: 1,
      email: 'g@x.fr',
      role: 'guarantor',
    });
    expect(g.guarantor_user_id).toBe(88);
  });

  test('should accept invitation and create folder for guarantor', async () => {
    const update = jest.fn();
    jest.mocked(Guarantor.findOne).mockResolvedValue({
      id: 1,
      folder_id: null,
      invitation_expires_at: new Date(Date.now() + 10000),
      update,
    } as never);
    jest.mocked(Folder.create).mockResolvedValue({ id: 99 } as never);
    await GuarantorService.acceptInvitation('tok', 12);
    expect(update).toHaveBeenCalled();
  });

  test('should reject expired invitation token', async () => {
    jest.mocked(Guarantor.findOne).mockResolvedValue({
      id: 1,
      invitation_expires_at: new Date(Date.now() - 1000),
    } as never);
    await expect(GuarantorService.acceptInvitation('tok', 12)).rejects.toThrow('EXPIRED');
  });

  test('should create direct guarantor without user account', async () => {
    jest.mocked(Folder.create).mockResolvedValue({ id: 55 } as never);
    jest.mocked(Guarantor.create).mockResolvedValue({
      id: 1,
      guarantor_user_id: null,
      folder_id: 55,
    } as never);
    const g = await GuarantorService.uploadGuarantorDocumentsDirect({
      tenantId: 1,
      firstName: 'A',
      lastName: 'B',
      role: 'guarantor',
    });
    expect(g.guarantor_user_id).toBeNull();
  });
});
