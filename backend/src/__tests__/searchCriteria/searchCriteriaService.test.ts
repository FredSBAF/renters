import { sequelize } from '../../config/database';
import {
  SearchCriteria,
  SearchCriteriaCity,
  SearchCriteriaPropertyType,
} from '../../models';
import * as service from '../../services/searchCriteria.service';

jest.mock('../../config/database', () => ({
  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock('../../models', () => ({
  SearchCriteria: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  SearchCriteriaCity: {
    destroy: jest.fn(),
    bulkCreate: jest.fn(),
  },
  SearchCriteriaPropertyType: {
    destroy: jest.fn(),
    bulkCreate: jest.fn(),
  },
  User: {},
  AuditLog: {},
  Agency: {},
  RefreshToken: {},
  EmailVerificationToken: {},
  PasswordResetToken: {},
  UserConsent: {},
  PaymentLog: {},
  Folder: {},
  DocumentType: {},
  Document: {},
  SharingLink: {},
  SharingView: {},
  Guarantor: {},
  ModerationQueue: {},
  Notification: {},
  NotificationPreference: {},
}));

describe('searchCriteriaService', () => {
  const payload = {
    cities: [{ name: 'Paris', place_id: 'p1', lat: 48.85, lng: 2.35, radius_km: 5 }],
    property_types: ['T2'],
    budget_ideal: 800,
    budget_max: 1000,
    availability_type: 'immediate' as const,
    availability_date: null,
    presentation_text: 'Texte de présentation suffisant.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (sequelize.transaction as jest.Mock).mockResolvedValue({
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    });
  });

  test('upsert creates when missing', async () => {
    jest
      .mocked(SearchCriteria.findOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 55, toJSON: () => ({ id: 55 }) } as never);
    jest.mocked(SearchCriteria.create).mockResolvedValue({ id: 55 } as never);

    const result = await service.upsert(1, payload);
    expect(result).toBeTruthy();
    expect(SearchCriteria.create).toHaveBeenCalled();
  });

  test('upsert updates when existing', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    jest
      .mocked(SearchCriteria.findOne)
      .mockResolvedValueOnce({ id: 10, update } as never)
      .mockResolvedValueOnce({ id: 10, toJSON: () => ({ id: 10 }) } as never);

    await service.upsert(1, payload);
    expect(update).toHaveBeenCalled();
  });

  test('upsert rollback on city bulkCreate error', async () => {
    const tx = { commit: jest.fn(), rollback: jest.fn() };
    (sequelize.transaction as jest.Mock).mockResolvedValue(tx);
    jest
      .mocked(SearchCriteria.findOne)
      .mockResolvedValueOnce(null);
    jest.mocked(SearchCriteria.create).mockResolvedValue({ id: 55 } as never);
    jest.mocked(SearchCriteriaCity.bulkCreate).mockRejectedValue(new Error('CITY_FAIL'));

    await expect(service.upsert(1, payload)).rejects.toThrow('CITY_FAIL');
    expect(tx.rollback).toHaveBeenCalled();
  });

  test('getByUserId returns null when missing', async () => {
    jest.mocked(SearchCriteria.findOne).mockResolvedValueOnce(null);
    const result = await service.getByUserId(999);
    expect(result).toBeNull();
  });
});
