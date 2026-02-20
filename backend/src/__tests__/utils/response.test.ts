import { successResponse, errorResponse } from '../../utils/response';

describe('response utils', () => {
  describe('successResponse', () => {
    test('sends 200 and standard success format by default', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      successResponse(res as never, { id: 1 }, 'OK');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1 },
        message: 'OK',
        errors: [],
      });
    });

    test('uses custom status code when provided', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      successResponse(res as never, null, 'Created', 201);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('errorResponse', () => {
    test('sends 400 and standard error format by default', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      errorResponse(res as never, 'Bad request');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        message: 'Bad request',
        errors: [],
      });
    });

    test('includes errors array when provided', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      errorResponse(res as never, 'Validation failed', ['field required'], 422);
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        message: 'Validation failed',
        errors: ['field required'],
      });
    });
  });
});
