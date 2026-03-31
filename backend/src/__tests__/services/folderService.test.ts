import { AuditLog, Document, DocumentType, Folder, User } from '../../models';
import { recalculateFolderCompletion } from '../../services/folder.service';

jest.mock('../../models', () => ({
  User: { findByPk: jest.fn() },
  Folder: { findOne: jest.fn() },
  DocumentType: { findAll: jest.fn() },
  Document: { findAll: jest.fn() },
  AuditLog: { create: jest.fn() },
}));

describe('recalculateFolderCompletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('employee_cdi -> student recalculates required docs', async () => {
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 1,
      tenant_profile: 'student',
    } as never);
    const update = jest.fn();
    jest.mocked(Folder.findOne).mockResolvedValue({
      id: 10,
      user_id: 1,
      completion_percentage: 66,
      update,
    } as never);
    jest.mocked(DocumentType.findAll).mockResolvedValue([
      { code: 'identity_card', required_for_profiles: ['all'], is_required: true },
      { code: 'student_card', required_for_profiles: ['student'], is_required: true },
      { code: 'payslip', required_for_profiles: ['employee_cdi'], is_required: true },
    ] as never);
    jest.mocked(Document.findAll).mockResolvedValue([
      { document_type: 'identity_card', status: 'valid' },
      { document_type: 'student_card', status: 'valid' },
    ] as never);

    await recalculateFolderCompletion(1);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ completion_percentage: 100 }));
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'folder.completion_recalculated' })
    );
  });

  test('profile with more required docs decreases completion', async () => {
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 2,
      tenant_profile: 'employee_cdi',
    } as never);
    const update = jest.fn();
    jest.mocked(Folder.findOne).mockResolvedValue({
      id: 11,
      user_id: 2,
      completion_percentage: 100,
      update,
    } as never);
    jest.mocked(DocumentType.findAll).mockResolvedValue([
      { code: 'identity_card', required_for_profiles: ['all'], is_required: true },
      { code: 'payslip', required_for_profiles: ['employee_cdi'], is_required: true },
    ] as never);
    jest.mocked(Document.findAll).mockResolvedValue([
      { document_type: 'identity_card', status: 'valid' },
    ] as never);

    await recalculateFolderCompletion(2);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ completion_percentage: 50 }));
  });

  test('no folder is a no-op', async () => {
    jest.mocked(User.findByPk).mockResolvedValue({
      id: 3,
      tenant_profile: 'student',
    } as never);
    jest.mocked(Folder.findOne).mockResolvedValue(null);

    await expect(recalculateFolderCompletion(3)).resolves.toBeUndefined();
    expect(DocumentType.findAll).not.toHaveBeenCalled();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });
});
