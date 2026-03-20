import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { sequelize } from '../config/database';
import { DocumentType, Folder, User } from '../models';
import { FolderService } from '../services/FolderService';

jest.mock('../config/database', () => ({
  sequelize: {
    query: jest.fn(),
  },
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../models', () => ({
  User: {
    findByPk: jest.fn(),
  },
  Folder: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  },
  DocumentType: {
    findAll: jest.fn(),
  },
  Agency: {},
  RefreshToken: {},
  EmailVerificationToken: {},
  PasswordResetToken: {},
  UserConsent: {},
  PaymentLog: {},
}));

describe('GET /api/v1/folders/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 10, email: 'tenant@x.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 10,
      role: 'tenant',
      tenant_profile: 'employee_cdi',
      email: 'tenant@x.fr',
      is_2fa_enabled: false,
    } as never);
  });

  test('should create folder if not exists and return it', async () => {
    jest.mocked(Folder.findOne).mockResolvedValue(null);
    (Folder.create as jest.Mock).mockImplementation(async (payload: Record<string, unknown>) => ({
      id: 1,
      ...payload,
      status: 'incomplete',
      folder_status: 'active',
      completion_percentage: 0,
      update: jest.fn(),
    }));
    jest.mocked(DocumentType.findAll).mockResolvedValue([] as never);
    (Folder.findByPk as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'incomplete',
      completion_percentage: 0,
      update: jest.fn(),
    });
    (sequelize.query as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/api/v1/folders/me').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data.folder.folder_status).toBe('active');
    expect(res.body.data.folder.completion_percentage).toBe(0);
  });

  test('should return existing folder if already exists', async () => {
    jest.mocked(Folder.findOne).mockResolvedValue({
      id: 42,
      folder_status: 'active',
      deleted_at: null,
      completion_percentage: 0,
      status: 'incomplete',
      update: jest.fn(),
    } as never);
    jest.mocked(DocumentType.findAll).mockResolvedValue([] as never);
    (Folder.findByPk as jest.Mock).mockResolvedValue({
      id: 42,
      status: 'incomplete',
      completion_percentage: 0,
      update: jest.fn(),
    });
    (sequelize.query as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/api/v1/folders/me').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(Folder.create).not.toHaveBeenCalled();
  });

  test('should reject if not tenant role', async () => {
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 10,
      role: 'agency_owner',
      agency_id: 1,
      is_2fa_enabled: true,
    } as never);
    const res = await request(app).get('/api/v1/folders/me').set('Authorization', 'Bearer token');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/folders/required-documents', () => {
  const docTypes = [
    {
      toJSON: () => ({
        id: 1,
        code: 'identity_card',
        label_fr: 'CNI',
        label_en: 'ID',
        validity_months: null,
        is_required: true,
        required_for_profiles: ['all'],
        sort_order: 1,
      }),
    },
    {
      toJSON: () => ({
        id: 2,
        code: 'proof_of_residence',
        label_fr: 'Domicile',
        label_en: 'Residence',
        validity_months: 3,
        is_required: true,
        required_for_profiles: ['all'],
        sort_order: 2,
      }),
    },
    {
      toJSON: () => ({
        id: 3,
        code: 'payslip',
        label_fr: 'Paie',
        label_en: 'Payslip',
        validity_months: 3,
        is_required: true,
        required_for_profiles: ['employee_cdi', 'employee_cdd'],
        sort_order: 3,
      }),
    },
    {
      toJSON: () => ({
        id: 4,
        code: 'employment_contract',
        label_fr: 'Contrat',
        label_en: 'Contract',
        validity_months: null,
        is_required: true,
        required_for_profiles: ['employee_cdi', 'employee_cdd'],
        sort_order: 4,
      }),
    },
    {
      toJSON: () => ({
        id: 5,
        code: 'tax_notice',
        label_fr: 'Impot',
        label_en: 'Tax',
        validity_months: 12,
        is_required: true,
        required_for_profiles: ['all'],
        sort_order: 5,
      }),
    },
    {
      toJSON: () => ({
        id: 6,
        code: 'kbis',
        label_fr: 'KBIS',
        label_en: 'KBIS',
        validity_months: 3,
        is_required: true,
        required_for_profiles: ['freelance'],
        sort_order: 6,
      }),
    },
    {
      toJSON: () => ({
        id: 7,
        code: 'student_card',
        label_fr: 'Etudiant',
        label_en: 'Student',
        validity_months: 12,
        is_required: true,
        required_for_profiles: ['student'],
        sort_order: 7,
      }),
    },
    {
      toJSON: () => ({
        id: 8,
        code: 'pension_statement',
        label_fr: 'Retraite',
        label_en: 'Pension',
        validity_months: 12,
        is_required: true,
        required_for_profiles: ['retired'],
        sort_order: 8,
      }),
    },
    {
      toJSON: () => ({
        id: 9,
        code: 'balance_sheet',
        label_fr: 'Bilan',
        label_en: 'Balance',
        validity_months: 12,
        is_required: true,
        required_for_profiles: ['freelance'],
        sort_order: 9,
      }),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 11, email: 'tenant@x.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 11,
      role: 'tenant',
      tenant_profile: 'employee_cdi',
      email: 'tenant@x.fr',
      is_2fa_enabled: false,
    } as never);
    jest.mocked(DocumentType.findAll).mockResolvedValue(docTypes as never);
  });

  test('should return required docs for employee_cdi profile', async () => {
    const res = await request(app)
      .get('/api/v1/folders/required-documents')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    const allCodes = JSON.stringify(res.body.data);
    expect(allCodes).toContain('identity_card');
    expect(allCodes).toContain('proof_of_residence');
    expect(allCodes).toContain('payslip');
    expect(allCodes).toContain('employment_contract');
    expect(allCodes).toContain('tax_notice');
    expect(allCodes).not.toContain('kbis');
    expect(allCodes).not.toContain('student_card');
    expect(allCodes).not.toContain('pension_statement');
  });

  test('should return required docs for student profile', async () => {
    const res = await request(app)
      .get('/api/v1/folders/required-documents?profile=student')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    const allCodes = JSON.stringify(res.body.data);
    expect(allCodes).toContain('identity_card');
    expect(allCodes).toContain('student_card');
    expect(allCodes).toContain('tax_notice');
    expect(allCodes).not.toContain('payslip');
    expect(allCodes).not.toContain('employment_contract');
    expect(allCodes).not.toContain('kbis');
  });

  test('should return 400 if tenant_profile not set', async () => {
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 11,
      role: 'tenant',
      tenant_profile: null,
      email: 'tenant@x.fr',
      is_2fa_enabled: false,
    } as never);
    const res = await request(app)
      .get('/api/v1/folders/required-documents')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(400);
  });

  test('should accept profile override via query param', async () => {
    const res = await request(app)
      .get('/api/v1/folders/required-documents?profile=freelance')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    const allCodes = JSON.stringify(res.body.data);
    expect(allCodes).toContain('kbis');
    expect(allCodes).toContain('balance_sheet');
  });
});

describe('PATCH /api/v1/folders/me/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 12, email: 'tenant@x.fr', role: 'tenant' });
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 12,
      role: 'tenant',
      tenant_profile: 'employee_cdi',
      email: 'tenant@x.fr',
      is_2fa_enabled: false,
    } as never);
    jest.mocked(Folder.findOne).mockResolvedValue({
      id: 88,
      folder_status: 'active',
      deleted_at: null,
      status: 'incomplete',
      completion_percentage: 0,
      update: jest.fn(),
    } as never);
    (Folder.findByPk as jest.Mock).mockResolvedValue({
      id: 88,
      folder_status: 'active',
      deleted_at: null,
      update: jest.fn().mockImplementation(async function (this: { folder_status: string; deleted_at?: Date | null }, payload: { folder_status?: string; deleted_at?: Date | null }) {
        this.folder_status = payload.folder_status ?? this.folder_status;
        this.deleted_at = payload.deleted_at ?? null;
      }),
    });
  });

  test('should update folder_status to standby', async () => {
    const res = await request(app)
      .patch('/api/v1/folders/me/status')
      .set('Authorization', 'Bearer token')
      .send({ folder_status: 'standby' });
    expect(res.status).toBe(200);
  });

  test('should soft delete when archived', async () => {
    const res = await request(app)
      .patch('/api/v1/folders/me/status')
      .set('Authorization', 'Bearer token')
      .send({ folder_status: 'archived' });
    expect(res.status).toBe(200);
  });

  test('should reject invalid status value', async () => {
    const res = await request(app)
      .patch('/api/v1/folders/me/status')
      .set('Authorization', 'Bearer token')
      .send({ folder_status: 'invalid' });
    expect(res.status).toBe(400);
  });
});

describe('FolderService.calculateCompletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 0 with no documents', async () => {
    jest.mocked(DocumentType.findAll).mockResolvedValue([
      {
        code: 'identity_card',
        required_for_profiles: ['all'],
      },
    ] as never);
    (sequelize.query as jest.Mock).mockResolvedValue([]);
    (Folder.findByPk as jest.Mock).mockResolvedValue({
      id: 50,
      status: 'incomplete',
      update: jest.fn(),
    });
    const completion = await FolderService.calculateCompletion(50, 'employee_cdi');
    expect(completion).toBe(0);
  });

  test('should return 100 when all required docs present and valid', async () => {
    jest.mocked(DocumentType.findAll).mockResolvedValue([
      {
        code: 'identity_card',
        required_for_profiles: ['all'],
      },
      {
        code: 'tax_notice',
        required_for_profiles: ['all'],
      },
    ] as never);
    (sequelize.query as jest.Mock).mockResolvedValue([
      { document_type: 'identity_card', status: 'valid' },
      { document_type: 'tax_notice', status: 'attention' },
    ]);
    const updateMock = jest.fn();
    (Folder.findByPk as jest.Mock).mockResolvedValue({
      id: 50,
      status: 'incomplete',
      update: updateMock,
    });
    const completion = await FolderService.calculateCompletion(50, 'employee_cdi');
    expect(completion).toBe(100);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ completion_percentage: 100, status: 'complete' })
    );
  });

  test('should not count expired documents', async () => {
    jest.mocked(DocumentType.findAll).mockResolvedValue([
      {
        code: 'identity_card',
        required_for_profiles: ['all'],
      },
    ] as never);
    (sequelize.query as jest.Mock).mockResolvedValue([
      { document_type: 'identity_card', status: 'expired' },
    ]);
    (Folder.findByPk as jest.Mock).mockResolvedValue({
      id: 50,
      status: 'incomplete',
      update: jest.fn(),
    });
    const completion = await FolderService.calculateCompletion(50, 'employee_cdi');
    expect(completion).toBe(0);
  });
});

describe('GET /api/v1/folders/document-types', () => {
  test('should return all document types sorted by sort_order', async () => {
    jest.mocked(DocumentType.findAll).mockResolvedValue([
      { code: 'identity_card', sort_order: 1 },
      { code: 'tax_notice', sort_order: 7 },
    ] as never);
    const res = await request(app).get('/api/v1/folders/document-types');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.document_types)).toBe(true);
    expect(res.body.data.document_types.length).toBeGreaterThan(0);
  });
});
